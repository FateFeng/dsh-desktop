/** Authenticated, read-only Git review endpoints scoped to registered Workspaces. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { SubprocessExecutableNotFoundError, type SubprocessHandle, type SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-workspace-changes'
import {
  GIT_REVIEW_DIFF_PATH,
  GIT_REVIEW_LAST_TURN_PATH,
  GIT_REVIEW_MAX_DIFF_BYTES,
  GIT_REVIEW_MAX_FILES,
  GIT_REVIEW_MAX_COMMITS,
  GIT_REVIEW_STATUS_PATH,
  GIT_REVIEW_WORKSPACES_PATH,
  isGitReviewPath,
  isGitReviewCommitId,
  parseGitReviewBranches,
  parseGitReviewCommits,
  parseGitReviewNumstat,
  parseGitReviewStatus,
  type GitReviewDiffCategory,
  type GitReviewFile,
  type GitReviewWorkspace,
} from './git-review-contract.ts'

export const name = 'desktop-git-review'
export const inject = ['webServer', 'connection', 'subprocess', 'workspaceRegistry', 'sessions', 'workspaceChanges']

const GIT_TIMEOUT_MS = 12_000
const GIT_GRACE_MS = 1_000
const STDERR_MAX_BYTES = 16_000
const STATUS_MAX_BYTES = 1_000_000
const GIT_ENV_TOMBSTONES = Object.freeze([
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_SHALLOW_FILE', 'GIT_REPLACE_REF_BASE', 'GIT_GRAFT_FILE',
  'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_SYSTEM',
])

class GitReviewError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
    this.name = 'GitReviewError'
  }
}

interface RequestLifetime {
  readonly signal: AbortSignal
  dispose(): void
}

interface GitOutput {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
}

function json(res: ServerResponse, status: number, value: unknown): void {
  if (res.destroyed || res.writableEnded) return
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(value))
}

function rejectRequest(ctx: Context, req: IncomingMessage, res: ServerResponse): boolean {
  const rejection = ctx.connection.requestRejection(req)
  if (rejection === undefined) return false
  res.writeHead(rejection)
  res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
  return true
}

function requestLifetime(req: IncomingMessage, res: ServerResponse, lifetimes: Set<AbortController>): RequestLifetime {
  const controller = new AbortController()
  const abort = (): void => { if (!res.writableEnded) controller.abort() }
  lifetimes.add(controller)
  req.once('aborted', abort)
  res.once('close', abort)
  return {
    signal: controller.signal,
    dispose: () => {
      req.off('aborted', abort)
      res.off('close', abort)
      lifetimes.delete(controller)
    },
  }
}

function requireGet(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method === 'GET') return true
  res.setHeader('allow', 'GET')
  json(res, 405, { error: 'method not allowed', code: 'method-not-allowed' })
  return false
}

function parseUrl(req: IncomingMessage): URL { return new URL(req.url ?? '/', 'http://127.0.0.1') }

function workspaceFor(ctx: Context, id: string | null) {
  if (id === null || id.length > 128) throw new GitReviewError('Choose a valid workspace.', 400, 'invalid-workspace')
  const workspace = ctx.workspaceRegistry.list().find(candidate => candidate.id === id)
  if (workspace === undefined) throw new GitReviewError('The selected workspace is no longer available.', 404, 'workspace-not-found')
  return workspace
}

async function runGit(
  ctx: Context,
  cwd: string,
  args: readonly string[],
  signal: AbortSignal,
  handles: Set<SubprocessHandle>,
  maxBytes = STATUS_MAX_BYTES,
  allowExitOne = false,
): Promise<GitOutput> {
  const timeout = AbortSignal.timeout(GIT_TIMEOUT_MS)
  const commandSignal = AbortSignal.any([signal, timeout])
  let handle: SubprocessHandle | undefined
  try {
    const executable = await ctx.subprocess.resolveExecutable('git', undefined, commandSignal)
    const spec: SubprocessSpawnSpec = {
      argv: [executable, '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args],
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes },
        stderr: { maxBytes: STDERR_MAX_BYTES },
      },
      graceMs: GIT_GRACE_MS,
      signal: commandSignal,
      env: {
        ...Object.fromEntries(GIT_ENV_TOMBSTONES.map(key => [key, undefined])),
        GIT_CONFIG_COUNT: '0', GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
        GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
        GIT_PAGER: 'cat', PAGER: 'cat', GIT_LITERAL_PATHSPECS: '1', LC_ALL: 'C',
      },
    }
    handle = ctx.subprocess.spawn(spec)
    handles.add(handle)
    const outcome = await handle.done
    await handle.waitForExit()
    if (timeout.aborted) throw new GitReviewError('Git review timed out. Try again.', 504, 'git-timeout')
    if (signal.aborted) throw new GitReviewError('The Git review request was cancelled.', 499, 'request-cancelled')
    const stdout = handle.collected.stdout?.readFrom(0) ?? { text: '', lossy: false }
    const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
    if (stdout.lossy) throw new GitReviewError('Git output exceeded the review limit.', 413, 'output-too-large')
    if (outcome.exitCode !== 0 && !(allowExitOne && outcome.exitCode === 1)) {
      throw new GitReviewError('Git could not read this workspace. Check that it is a valid repository.', 409, 'git-failed')
    }
    return { stdout: stdout.text, stderr, exitCode: outcome.exitCode }
  } finally {
    if (handle !== undefined) handles.delete(handle)
  }
}

function withNumstat(files: readonly GitReviewFile[], output: string): GitReviewFile[] {
  const counts = parseGitReviewNumstat(output)
  return files.map(file => ({ ...file, ...(counts.get(file.path) ?? { additions: 0, deletions: 0 }) }))
}

async function worktreePathFor(ctx: Context, workspace: ReturnType<typeof workspaceFor>, signal: AbortSignal, handles: Set<SubprocessHandle>): Promise<string> {
  const root = await runGit(ctx, workspace.path, ['rev-parse', '--show-toplevel'], signal, handles)
  const worktreePath = root.stdout.trim()
  if (worktreePath.length === 0) throw new GitReviewError('The selected workspace is not inside a Git repository.', 409, 'not-a-repository')
  return worktreePath
}

async function listReviewWorkspaces(ctx: Context, signal: AbortSignal, handles: Set<SubprocessHandle>): Promise<GitReviewWorkspace[]> {
  const roots = new Map<string, { workspace: ReturnType<typeof workspaceFor>; worktreePath: string; sessionIds: Set<SessionId> }>()
  const nonRepositories: GitReviewWorkspace[] = []
  const byDirectory = new Map<string, string | null>()
  for (const workspace of ctx.workspaceRegistry.list()) {
    let worktreePath = byDirectory.get(workspace.path)
    if (worktreePath === undefined && !byDirectory.has(workspace.path)) {
      try {
        worktreePath = await worktreePathFor(ctx, workspace, signal, handles)
        byDirectory.set(workspace.path, worktreePath)
      } catch (cause) {
        if (!(cause instanceof GitReviewError) || cause.code !== 'git-failed') throw cause
        byDirectory.set(workspace.path, null)
        worktreePath = null
      }
    }
    if (worktreePath === null || worktreePath === undefined) {
      nonRepositories.push({ workspaceId: workspace.id, workspaceTitle: workspace.title, path: workspace.path, repository: false, sessionIds: workspace.sessionIds })
      continue
    }
    const key = process.platform === 'win32' ? worktreePath.toLowerCase() : worktreePath
    const current = roots.get(key)
    if (current === undefined) {
      roots.set(key, { workspace, worktreePath, sessionIds: new Set(workspace.sessionIds) })
      continue
    }
    for (const sessionId of workspace.sessionIds) current.sessionIds.add(sessionId)
    if (workspace.sessionIds.length > current.workspace.sessionIds.length
      || (workspace.sessionIds.length === current.workspace.sessionIds.length
        && workspace.path === worktreePath && current.workspace.path !== current.worktreePath)) {
      current.workspace = workspace
    }
  }
  const repositories: GitReviewWorkspace[] = [...roots.values()].map(({ workspace, worktreePath, sessionIds }) => ({
    workspaceId: workspace.id,
    workspaceTitle: workspace.title,
    path: workspace.path,
    worktreePath,
    repository: true,
    sessionIds: [...sessionIds],
  }))
  return [...repositories, ...nonRepositories]
}

async function readStatus(ctx: Context, workspace: ReturnType<typeof workspaceFor>, signal: AbortSignal, handles: Set<SubprocessHandle>) {
  const worktreePath = await worktreePathFor(ctx, workspace, signal, handles)
  const [porcelain, unstagedCounts, stagedCounts, branches, commits] = await Promise.all([
    runGit(ctx, worktreePath, ['status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all', '--', '.'], signal, handles),
    runGit(ctx, worktreePath, ['diff', '--numstat', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', '--', '.'], signal, handles),
    runGit(ctx, worktreePath, ['diff', '--cached', '--numstat', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', '--', '.'], signal, handles),
    runGit(ctx, worktreePath, ['branch', '--no-color', '--all', '--format=%(HEAD) %(refname)%00'], signal, handles),
    runGit(ctx, worktreePath, ['log', `-${GIT_REVIEW_MAX_COMMITS}`, '--no-color', '--format=%H%x00%s%x00%an%x00%at%x00', '--', '.'], signal, handles),
  ])
  const parsed = parseGitReviewStatus(workspace.id, workspace.title, porcelain.stdout)
  const tracked = { ...parsed,
    unstaged: withNumstat(parsed.unstaged, unstagedCounts.stdout),
    staged: withNumstat(parsed.staged, stagedCounts.stdout),
  }
  return {
    ...tracked,
    repository: true,
    worktreePath,
    branches: parseGitReviewBranches(branches.stdout),
    commits: parseGitReviewCommits(commits.stdout),
  }
}

function latestTurn(ctx: Context, workspace: ReturnType<typeof workspaceFor>) {
  let latest: { sessionId: string; seq: number; turn: number; time: number; summary: NonNullable<ReturnType<typeof ctx.workspaceChanges.summary>> } | undefined
  for (const id of workspace.sessionIds) {
    const session = ctx.sessions.get(id)
    if (session === undefined || session.header.cwd !== workspace.path) continue
    const events = session.snapshotEvents()
    for (let at = events.length - 1; at >= 0; at--) {
      const event = events[at]
      if (event?.type !== 'workspace/changes') continue
      const summary = ctx.workspaceChanges.summary(id, event.seq)
      if (summary === undefined || summary.cwd !== workspace.path) continue
      if (latest === undefined || event.time > latest.time) {
        latest = { sessionId: id, seq: event.seq, turn: event.data.turn, time: event.time, summary }
      }
      break
    }
  }
  return latest
}

function parseLastTurn(ctx: Context, workspace: ReturnType<typeof workspaceFor>) {
  const latest = latestTurn(ctx, workspace)
  if (latest === undefined) return { available: false as const, files: [] }
  return {
    available: true as const,
    sessionId: latest.sessionId,
    cwd: latest.summary.cwd,
    seq: latest.seq,
    turn: latest.turn,
    time: latest.time,
    filesTotal: latest.summary.files.length,
    omittedFiles: Math.max(0, latest.summary.files.length - GIT_REVIEW_MAX_FILES),
    files: latest.summary.files.slice(0, GIT_REVIEW_MAX_FILES).map(file => ({
      path: file.path, display: file.display, status: 'last-turn', additions: file.added, deletions: file.deleted,
    })),
  }
}

function safeError(res: ServerResponse, cause: unknown): void {
  if (res.destroyed || res.writableEnded) return
  if (cause instanceof SubprocessExecutableNotFoundError) {
    json(res, 503, { error: 'Git was not found on PATH.', code: 'git-not-found' })
  } else if (cause instanceof GitReviewError) {
    json(res, cause.status, { error: cause.message, code: cause.code })
  } else {
    json(res, 502, { error: 'The Git review request failed.', code: 'git-review-failed' })
  }
}

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const lifetimes = new Set<AbortController>()
    const handles = new Set<SubprocessHandle>()
    const register = (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>): (() => void) => ctx.webServer.register({
      kind: 'exact', path,
      handler: (req, res) => {
        if (rejectRequest(ctx, req, res) || !requireGet(req, res)) return
        return handler(req, res)
      },
    })
    const withRequest = (handler: (req: IncomingMessage, res: ServerResponse, signal: AbortSignal) => Promise<void>) =>
      async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const lifetime = requestLifetime(req, res, lifetimes)
        try { await handler(req, res, lifetime.signal) }
        catch (cause) { safeError(res, cause) }
        finally { lifetime.dispose() }
      }
    const unregisterWorkspaces = register(GIT_REVIEW_WORKSPACES_PATH, withRequest(async (_req, res, signal) => {
      json(res, 200, { workspaces: await listReviewWorkspaces(ctx, signal, handles) })
    }))
    const unregisterStatus = register(GIT_REVIEW_STATUS_PATH, withRequest(async (req, res, signal) => {
      const workspace = workspaceFor(ctx, parseUrl(req).searchParams.get('workspaceId'))
      json(res, 200, await readStatus(ctx, workspace, signal, handles))
    }))
    const unregisterDiff = register(GIT_REVIEW_DIFF_PATH, withRequest(async (req, res, signal) => {
      const query = parseUrl(req).searchParams
      const workspace = workspaceFor(ctx, query.get('workspaceId'))
      const category = query.get('category')
      if (category !== 'last-turn' && category !== 'unstaged' && category !== 'untracked' && category !== 'staged' && category !== 'committed') {
        throw new GitReviewError('Choose a supported Git review category.', 400, 'invalid-category')
      }
      if (category === 'last-turn') {
        const index = Number(query.get('index'))
        const latest = latestTurn(ctx, workspace)
        if (latest === undefined) throw new GitReviewError('No live last-turn comparison is available for this workspace.', 404, 'last-turn-unavailable')
        if (!Number.isInteger(index) || index < 0 || index >= latest.summary.files.length || index >= GIT_REVIEW_MAX_FILES) {
          throw new GitReviewError('Choose a valid last-turn file.', 400, 'invalid-index')
        }
        const turnDiff = await ctx.workspaceChanges.diff(latest.sessionId as SessionId, latest.seq, index, signal)
        if (turnDiff === undefined) throw new GitReviewError('The last-turn comparison is no longer available.', 404, 'last-turn-unavailable')
        json(res, 200, { diff: '', turnDiff })
        return
      }
      if (category === 'committed') {
        const commitId = query.get('commitId')
        if (commitId === null || !isGitReviewCommitId(commitId)) throw new GitReviewError('Choose a valid commit.', 400, 'invalid-commit')
        const status = await readStatus(ctx, workspace, signal, handles)
        if (!status.commits.some(commit => commit.id === commitId)) throw new GitReviewError('This commit is no longer available in this workspace.', 404, 'commit-not-found')
        const result = await runGit(ctx, status.worktreePath,
          ['show', '--no-color', '--no-ext-diff', '--no-textconv', '--format=', commitId, '--', '.'],
          signal, handles, GIT_REVIEW_MAX_DIFF_BYTES)
        json(res, 200, { diff: result.stdout })
        return
      }
      const path = query.get('path')
      if (path === null || !isGitReviewPath(path)) throw new GitReviewError('Choose a valid workspace-relative file.', 400, 'invalid-path')
      const status = await readStatus(ctx, workspace, signal, handles)
      const categoryFiles = category === 'unstaged' ? status.unstaged : category === 'staged' ? status.staged : status.untracked
      if (!categoryFiles.some(file => file.path === path)) throw new GitReviewError('This file is no longer in the selected change category.', 404, 'file-not-found')
      const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null'
      const args = category === 'untracked'
        ? ['diff', '--no-index', '--no-color', '--no-ext-diff', '--no-textconv', '--', nullDevice, path]
        : ['diff', ...(category === 'staged' ? ['--cached'] : []), '--no-color', '--no-ext-diff', '--no-textconv', '--', path]
      const result = await runGit(ctx, status.worktreePath, args, signal, handles, GIT_REVIEW_MAX_DIFF_BYTES, category === 'untracked')
      json(res, 200, { diff: result.stdout })
    }))
    const unregisterLastTurn = register(GIT_REVIEW_LAST_TURN_PATH, withRequest(async (req, res) => {
      const workspace = workspaceFor(ctx, parseUrl(req).searchParams.get('workspaceId'))
      json(res, 200, parseLastTurn(ctx, workspace))
    }))
    return async () => {
      unregisterWorkspaces()
      unregisterStatus()
      unregisterDiff()
      unregisterLastTurn()
      for (const lifetime of lifetimes) lifetime.abort()
      for (const handle of handles) handle.terminate()
      await Promise.allSettled([...handles].map(async handle => { await handle.done; await handle.waitForExit() }))
      lifetimes.clear()
      handles.clear()
    }
  }, 'desktop-git-review: authenticated read-only Git routes')
}

export type { GitReviewDiffCategory }
