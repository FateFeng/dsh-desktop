import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { SubprocessHandle, SubprocessRuntime, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { describe, expect, it, vi } from 'vitest'
import {
  GIT_REVIEW_DIFF_PATH, GIT_REVIEW_LAST_TURN_PATH, GIT_REVIEW_STATUS_PATH, GIT_REVIEW_WORKSPACES_PATH,
  isGitReviewCommitId, isGitReviewPath, parseGitReviewBranches, parseGitReviewCommits,
  parseGitReviewNumstat, parseGitReviewStatus,
} from '../src/git-review-contract.ts'
import { apply, inject, name } from '../src/git-review.ts'

function child(stdout: string, exitCode: number | null = 0): SubprocessHandle {
  return {
    stdin: undefined, stdout: undefined, stderr: undefined, control: undefined,
    collected: {
      stdout: { readFrom: () => ({ text: stdout, nextOffset: stdout.length, lossy: false }) },
      stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
    },
    done: Promise.resolve({ exitCode, signal: null }),
    terminate: vi.fn(), waitForExit: vi.fn(async () => true),
  }
}

function request(url: string, method = 'GET'): IncomingMessage {
  return Object.assign(new EventEmitter(), {
    method, url, headers: { host: '127.0.0.1:43120', origin: 'http://127.0.0.1:43120' },
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage
}

function response(): ServerResponse & { body: string } {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    statusCode: 200, writableEnded: false, destroyed: false, body: '',
    setHeader() {},
    writeHead(status: number) { this.statusCode = status },
    end(body = '') { this.body += String(body); this.writableEnded = true; emitter.emit('close') },
  }) as unknown as ServerResponse & { body: string }
}

async function harness(options: { children?: SubprocessHandle[]; rejection?: 401 | 403; workspaces?: readonly unknown[]; session?: unknown; summary?: unknown } = {}) {
  const routes = new Map<string, WebRoute>()
  const children = options.children ?? []
  const spawn = vi.fn((spec: SubprocessSpawnSpec) => {
    const next = children.shift()
    if (next === undefined) throw new Error(`unexpected Git spawn: ${spec.argv.join(' ')}`)
    return next
  })
  const requestRejection = vi.fn(() => options.rejection)
  const workspaceList = vi.fn(() => options.workspaces ?? [])
  let cleanup: void | (() => void | Promise<void>)
  const ctx = {
    webServer: { register(route: WebRoute) { routes.set(route.path, route); return () => { routes.delete(route.path) } } },
    connection: { requestRejection },
    subprocess: { resolveExecutable: vi.fn(async () => '/fixture/bin/git'), spawn },
    workspaceRegistry: { list: workspaceList },
    sessions: { get: vi.fn(() => options.session) },
    workspaceChanges: { summary: vi.fn(() => options.summary), diff: vi.fn(async () => undefined) },
    effect: (register: () => void | (() => void | Promise<void>)) => { cleanup = register() },
  } as unknown as Context
  apply(ctx)
  return {
    routes, spawn, requestRejection, workspaceList, subprocess: ctx.subprocess as SubprocessRuntime,
    teardown: async () => { if (typeof cleanup === 'function') await cleanup() },
  }
}

const workspace = { id: 'workspace-1', path: '/registered/project', title: 'project', sessionIds: [] }

describe('Desktop Git review contract', () => {
  it('separates untracked, unstaged, and staged porcelain records including renames', () => {
    const parsed = parseGitReviewStatus('workspace-1', 'project', [
      '## feature...origin/feature [ahead 2, behind 1]', ' M dirty.ts', 'A  staged.ts', '?? new.ts', 'R  renamed.ts', 'old.ts', '',
    ].join('\0'))
    expect(parsed).toMatchObject({ branch: 'feature', ahead: 2, behind: 1 })
    expect(parseGitReviewStatus('workspace-1', 'project', '## No commits yet on topic').branch).toBe('topic')
    expect(parsed.unstaged.map(file => file.path)).toEqual(['dirty.ts'])
    expect(parsed.staged.map(file => file.path)).toEqual(['staged.ts', 'renamed.ts'])
    expect(parsed.untracked.map(file => file.path)).toEqual(['new.ts'])
  })

  it('parses branches, commits, and numstat rows', () => {
    expect(parseGitReviewBranches('* refs/heads/main\0  refs/remotes/origin/main\0')).toEqual([
      { name: 'main', current: true, remote: false }, { name: 'origin/main', current: false, remote: true },
    ])
    expect(parseGitReviewCommits(`${'a'.repeat(40)}\0subject\0Author\0${1_600_000_000}\0`)).toEqual([
      { id: 'a'.repeat(40), subject: 'subject', author: 'Author', time: 1_600_000_000 },
    ])
    expect(parseGitReviewNumstat('3\t1\tfile.ts\0-\t-\tbinary.png\0').get('file.ts')).toEqual({ additions: 3, deletions: 1 })
    expect(parseGitReviewNumstat('3\t1\tfile.ts\0-\t-\tbinary.png\0').get('binary.png')).toEqual({ additions: 0, deletions: 0 })
  })

  it('rejects path traversal, absolute paths, and Git revision expressions', () => {
    expect(isGitReviewPath('src/file.ts')).toBe(true)
    expect(isGitReviewPath('../outside')).toBe(false)
    expect(isGitReviewPath('/etc/passwd')).toBe(false)
    expect(isGitReviewPath('C:/outside')).toBe(false)
    expect(isGitReviewPath('file\\name')).toBe(false)
    expect(isGitReviewCommitId('a'.repeat(40))).toBe(true)
    expect(isGitReviewCommitId('HEAD~1')).toBe(false)
  })
})

describe('Desktop Git review Host plugin', () => {
  it('registers only authenticated read-only review routes', async () => {
    const h = await harness()
    expect(name).toBe('desktop-git-review')
    expect(inject).toEqual(['webServer', 'connection', 'subprocess', 'workspaceRegistry', 'sessions', 'workspaceChanges'])
    expect([...h.routes.keys()]).toEqual([GIT_REVIEW_WORKSPACES_PATH, GIT_REVIEW_STATUS_PATH, GIT_REVIEW_DIFF_PATH, GIT_REVIEW_LAST_TURN_PATH])
    await h.teardown()
  })

  it('rejects unauthenticated requests before resolving a Workspace or spawning Git', async () => {
    const h = await harness({ rejection: 401 })
    const req = request(`${GIT_REVIEW_STATUS_PATH}?workspaceId=workspace-1`)
    const res = response()
    await h.routes.get(GIT_REVIEW_STATUS_PATH)!.handler(req, res)
    expect(h.requestRejection).toHaveBeenCalledWith(req)
    expect(h.workspaceList).not.toHaveBeenCalled()
    expect(h.spawn).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    await h.teardown()
  })

  it('groups duplicate Workspace registrations by canonical Git worktree', async () => {
    const nested = { id: 'workspace-2', path: '/registered/project/sub', title: 'nested', sessionIds: ['session-2'] }
    const h = await harness({ workspaces: [workspace, nested], children: [child('/repo/root\n'), child('/repo/root\n')] })
    const res = response()
    await h.routes.get(GIT_REVIEW_WORKSPACES_PATH)!.handler(request(GIT_REVIEW_WORKSPACES_PATH), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ workspaces: [{
      workspaceId: 'workspace-2', workspaceTitle: 'nested', path: '/registered/project/sub',
      worktreePath: '/repo/root', repository: true, sessionIds: ['session-2'],
    }] })
    await h.teardown()
  })

  it('rejects unknown Workspace ids before spawning any command', async () => {
    const h = await harness()
    const res = response()
    await h.routes.get(GIT_REVIEW_STATUS_PATH)!.handler(request(`${GIT_REVIEW_STATUS_PATH}?workspaceId=other`), res)
    expect(res.statusCode).toBe(404)
    expect(h.spawn).not.toHaveBeenCalled()
    await h.teardown()
  })

  it('derives the Git cwd from the registered Workspace, not query input', async () => {
    const h = await harness({ workspaces: [workspace], children: [
      child('/repo/root\n'), child('## main\0'), child(''), child(''), child('* refs/heads/main\0'), child(''),
    ] })
    const res = response()
    await h.routes.get(GIT_REVIEW_STATUS_PATH)!.handler(request(`${GIT_REVIEW_STATUS_PATH}?workspaceId=workspace-1&cwd=/tmp/other`), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ workspaceId: 'workspace-1', workspaceTitle: 'project', branch: 'main', repository: true, worktreePath: '/repo/root' })
    expect(h.spawn).toHaveBeenCalledTimes(6)
    for (const [index, [spec]] of h.spawn.mock.calls.entries()) {
      expect(spec.cwd).toBe(index === 0 ? '/registered/project' : '/repo/root')
      expect(spec.argv[0]).toBe('/fixture/bin/git')
      expect(spec.argv).toContain('core.fsmonitor=false')
      expect(spec.argv).not.toContain('/tmp/other')
      expect(spec.env).toMatchObject({
        GIT_LITERAL_PATHSPECS: '1', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '0', GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      })
      expect(spec.env).toMatchObject({ GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_INDEX_FILE: undefined, GIT_COMMON_DIR: undefined })
    }
    await h.teardown()
  })

  it('finds the latest turn in event-heavy Sessions and reports omitted files', async () => {
    const events = Array.from({ length: 100_001 }, (_, seq) => ({ type: 'message', seq, time: seq, data: {} }))
    events.push({ type: 'workspace/changes', seq: 100_001, time: 200_000, data: { turn: 7 } })
    const files = Array.from({ length: 501 }, (_, index) => ({
      path: `src/${index}.ts`, display: `src/${index}.ts`, added: 1, deleted: 0,
    }))
    const h = await harness({
      workspaces: [{ ...workspace, sessionIds: ['session-1'] }],
      session: { header: { cwd: workspace.path }, snapshotEvents: () => events },
      summary: { cwd: workspace.path, files },
    })
    const res = response()
    await h.routes.get(GIT_REVIEW_LAST_TURN_PATH)!.handler(
      request(`${GIT_REVIEW_LAST_TURN_PATH}?workspaceId=workspace-1`), res,
    )
    const parsed = JSON.parse(res.body) as { available: boolean; turn: number; filesTotal: number; omittedFiles: number; files: unknown[] }
    expect(res.statusCode).toBe(200)
    expect(parsed).toMatchObject({ available: true, turn: 7, filesTotal: 501, omittedFiles: 1 })
    expect(parsed.files).toHaveLength(500)
    await h.teardown()
  })

  it('rejects non-GET methods before any Git access', async () => {
    const h = await harness({ workspaces: [workspace] })
    const res = response()
    await h.routes.get(GIT_REVIEW_STATUS_PATH)!.handler(request(GIT_REVIEW_STATUS_PATH, 'POST'), res)
    expect(res.statusCode).toBe(405)
    expect(h.spawn).not.toHaveBeenCalled()
    await h.teardown()
  })

  it('rejects a traversal diff path before spawning Git', async () => {
    const h = await harness({ workspaces: [workspace] })
    const res = response()
    await h.routes.get(GIT_REVIEW_DIFF_PATH)!.handler(request(`${GIT_REVIEW_DIFF_PATH}?workspaceId=workspace-1&category=unstaged&path=..%2Fsecret`), res)
    expect(res.statusCode).toBe(400)
    expect(h.spawn).not.toHaveBeenCalled()
    await h.teardown()
  })

  it('reads file diffs from the canonical worktree and keeps path after the option separator', async () => {
    const h = await harness({ workspaces: [workspace], children: [
      child('/repo/root\n'), child('## main\0 M changed.ts\0'), child('1\t0\tchanged.ts\0'), child(''), child('* refs/heads/main\0'), child(''), child('diff --git a/changed.ts b/changed.ts\n+line\n'),
    ] })
    const res = response()
    await h.routes.get(GIT_REVIEW_DIFF_PATH)!.handler(request(`${GIT_REVIEW_DIFF_PATH}?workspaceId=workspace-1&category=unstaged&path=changed.ts`), res)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ diff: 'diff --git a/changed.ts b/changed.ts\n+line\n' })
    const [diffSpec] = h.spawn.mock.calls.at(-1) ?? []
    expect(diffSpec?.cwd).toBe('/repo/root')
    expect(diffSpec?.argv.slice(-2)).toEqual(['--', 'changed.ts'])
    await h.teardown()
  })
})
