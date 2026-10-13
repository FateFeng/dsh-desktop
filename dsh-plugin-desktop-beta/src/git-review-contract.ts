/** Same-origin Desktop Git-review endpoints and their bounded wire types. */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

export const GIT_REVIEW_WORKSPACES_PATH = '/api/desktop/git-review/workspaces'
export const GIT_REVIEW_STATUS_PATH = '/api/desktop/git-review/status'
export const GIT_REVIEW_DIFF_PATH = '/api/desktop/git-review/diff'
export const GIT_REVIEW_LAST_TURN_PATH = '/api/desktop/git-review/last-turn'

export type GitReviewCategory = 'last-turn' | 'unstaged' | 'untracked' | 'staged' | 'committed' | 'branches'
export type GitReviewDiffCategory = 'last-turn' | 'unstaged' | 'untracked' | 'staged' | 'committed'

export interface GitReviewFile {
  readonly path: string
  readonly status: string
  readonly additions: number
  readonly deletions: number
}

export interface GitReviewBranch {
  readonly name: string
  readonly current: boolean
  readonly remote: boolean
}

export interface GitReviewCommit {
  readonly id: string
  readonly subject: string
  readonly author: string
  readonly time: number
}

export interface GitReviewWorkspace {
  readonly workspaceId: string
  readonly workspaceTitle: string
  readonly path: string
  readonly worktreePath?: string
  readonly repository: boolean
  readonly sessionIds: readonly SessionId[]
}

export interface GitReviewStatus {
  readonly workspaceId: string
  readonly workspaceTitle: string
  readonly repository: boolean
  /** Canonical Git worktree root returned by `git rev-parse --show-toplevel`. */
  readonly worktreePath: string
  readonly branch?: string
  readonly ahead: number
  readonly behind: number
  readonly unstaged: readonly GitReviewFile[]
  readonly untracked: readonly GitReviewFile[]
  readonly staged: readonly GitReviewFile[]
  readonly branches: readonly GitReviewBranch[]
  readonly commits: readonly GitReviewCommit[]
}

export interface GitReviewLastTurnFile extends GitReviewFile {
  readonly display: string
}

export interface GitReviewLastTurn {
  readonly sessionId: SessionId
  readonly seq: number
  readonly turn: number
  readonly time: number
  readonly filesTotal: number
  readonly omittedFiles: number
  readonly files: readonly GitReviewLastTurnFile[]
}

export interface GitReviewTurnHunk {
  readonly oldStart: number
  readonly oldLines: number
  readonly newStart: number
  readonly newLines: number
  readonly lines: readonly string[]
}

export type GitReviewTurnDiff =
  | { readonly kind: 'text'; readonly path: string; readonly display: string; readonly before: boolean; readonly after: boolean; readonly coarse: boolean; readonly hunks: readonly GitReviewTurnHunk[] }
  | { readonly kind: 'binary' | 'oversized'; readonly path: string; readonly display: string }

export interface GitReviewDiff {
  readonly diff: string
  readonly turnDiff?: GitReviewTurnDiff
}

export interface GitReviewError {
  readonly error: string
  readonly code: string
}

export const GIT_REVIEW_MAX_DIFF_BYTES = 1_500_000
export const GIT_REVIEW_MAX_FILES = 500
export const GIT_REVIEW_MAX_COMMITS = 30
export const GIT_REVIEW_MAX_PATH_LENGTH = 4_096

/** Validate a repository-relative path without resolving or trusting it as a filesystem path. */
export function isGitReviewPath(value: string): boolean {
  if (value.length === 0 || value.length > GIT_REVIEW_MAX_PATH_LENGTH || value.includes('\0') || value.includes('\\')) return false
  if (value.startsWith('/') || /^[A-Za-z]:/u.test(value)) return false
  return value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..')
}

/** Parse a bounded `git status --porcelain=v1 -z --branch` response into independent status layers. */
export function parseGitReviewStatus(workspaceId: string, workspaceTitle: string, porcelain: string): Pick<GitReviewStatus,
  'workspaceId' | 'workspaceTitle' | 'branch' | 'ahead' | 'behind' | 'unstaged' | 'untracked' | 'staged'> {
  const entries = porcelain.split('\0')
  let branch: string | undefined
  let ahead = 0
  let behind = 0
  const unstaged: GitReviewFile[] = []
  const untracked: GitReviewFile[] = []
  const staged: GitReviewFile[] = []
  for (let at = 0; at < entries.length; at++) {
    const entry = entries[at]
    if (entry === undefined || entry.length === 0) continue
    if (entry.startsWith('## ')) {
      const summary = entry.slice(3)
      const state = summary.match(/^(.*?)\.\.\.(.*?) \[(.*)\]$/u)
      const unborn = /^No commits yet on (.+)$/u.exec(summary)
      branch = (state?.[1] ?? unborn?.[1] ?? summary.split(' ')[0]) || undefined
      for (const fact of (state?.[3] ?? '').split(', ')) {
        const aheadMatch = /^ahead (\d+)$/u.exec(fact)
        const behindMatch = /^behind (\d+)$/u.exec(fact)
        if (aheadMatch !== null) ahead = Number(aheadMatch[1])
        if (behindMatch !== null) behind = Number(behindMatch[1])
      }
      continue
    }
    if (entry.length < 4 || entry[2] !== ' ') continue
    const x = entry[0] ?? ' '
    const y = entry[1] ?? ' '
    const path = entry.slice(3)
    if (path.length === 0) continue
    const record: GitReviewFile = { path, status: `${x}${y}`, additions: 0, deletions: 0 }
    if (x === '?' && y === '?') {
      untracked.push(record)
      continue
    }
    if (x !== ' ' && x !== '?') staged.push(record)
    if (y !== ' ' && y !== '?') unstaged.push(record)
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') at++
  }
  return { workspaceId, workspaceTitle, ...(branch === undefined ? {} : { branch }), ahead, behind, unstaged, untracked, staged }
}

/** Parse NUL-delimited `git branch --format` rows. */
export function parseGitReviewBranches(output: string): GitReviewBranch[] {
  return output.split('\0').filter(Boolean).map(value => {
    const current = value.startsWith('*')
    const ref = value.slice(current ? 2 : 0).trim()
    const remote = ref.startsWith('refs/remotes/')
    const name = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length)
      : remote ? ref.slice('refs/remotes/'.length) : ref
    return { name, current, remote }
  })
}

/** Parse NUL-delimited `git log` fields and keep only complete records. */
export function parseGitReviewCommits(output: string): GitReviewCommit[] {
  const fields = output.split('\0')
  const commits: GitReviewCommit[] = []
  for (let at = 0; at + 3 < fields.length; at += 4) {
    const id = fields[at]?.trim() ?? ''
    const subject = fields[at + 1]?.trim() ?? ''
    const author = fields[at + 2]?.trim() ?? ''
    const time = Number(fields[at + 3]?.trim())
    if (/^[a-f\d]{40,64}$/iu.test(id) && Number.isFinite(time)) commits.push({ id, subject, author, time })
  }
  return commits.slice(0, GIT_REVIEW_MAX_COMMITS)
}

/** Parse NUL-delimited `git diff --numstat` rows while tolerating binary entries. */
export function parseGitReviewNumstat(output: string): Map<string, { additions: number; deletions: number }> {
  const result = new Map<string, { additions: number; deletions: number }>()
  const fields = output.split('\0')
  for (let at = 0; at < fields.length; at++) {
    const field = fields[at]
    if (field === undefined || field.length === 0) continue
    const first = field.indexOf('\t')
    const second = first < 0 ? -1 : field.indexOf('\t', first + 1)
    if (first < 0 || second < 0) continue
    const additions = Number(field.slice(0, first))
    const deletions = Number(field.slice(first + 1, second))
    const path = field.slice(second + 1)
    if (path.length > 0 && path !== '-') result.set(path, {
      additions: Number.isFinite(additions) ? additions : 0,
      deletions: Number.isFinite(deletions) ? deletions : 0,
    })
    if (path.length === 0 && fields[at + 1] !== undefined) at++
  }
  return result
}

/** Validate that a string is a Git object id, not an option or revision expression. */
export function isGitReviewCommitId(value: string): boolean { return /^[a-f\d]{40,64}$/iu.test(value) }

/** Restrict categories accepted by the diff endpoint. */
export function isGitReviewDiffCategory(value: string | null): value is GitReviewDiffCategory {
  return value === 'unstaged' || value === 'untracked' || value === 'staged'
}
