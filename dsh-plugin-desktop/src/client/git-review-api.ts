import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  GIT_REVIEW_DIFF_PATH,
  GIT_REVIEW_LAST_TURN_PATH,
  GIT_REVIEW_STATUS_PATH,
  GIT_REVIEW_WORKSPACES_PATH,
  type GitReviewDiff,
  type GitReviewDiffCategory,
  type GitReviewStatus,
  type GitReviewWorkspace,
} from '../git-review-contract.ts'

export interface GitReviewLastTurnView {
  readonly available: boolean
  readonly sessionId?: SessionId
  /** Working directory against which the selected turn's file paths are relative. */
  readonly cwd?: string
  readonly seq?: number
  readonly turn?: number
  readonly time?: number
  readonly filesTotal?: number
  readonly omittedFiles?: number
  readonly files: readonly import('../git-review-contract.ts').GitReviewLastTurnFile[]
}

export interface GitReviewClient {
  workspaces(signal: AbortSignal): Promise<readonly GitReviewWorkspace[]>
  status(workspaceId: string, signal: AbortSignal): Promise<GitReviewStatus>
  lastTurn(workspaceId: string, signal: AbortSignal): Promise<GitReviewLastTurnView>
  diff(input: {
    workspaceId: string
    category: GitReviewDiffCategory
    path?: string
    index?: number
    commitId?: string
    signal: AbortSignal
  }): Promise<GitReviewDiff>
}

async function request<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: 'GET', signal, headers: { accept: 'application/json' } })
  const body = await response.json() as T | { error?: string }
  if (!response.ok) throw new Error(typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`)
  return body as T
}

export function createGitReviewClient(): GitReviewClient {
  return {
    workspaces: async signal => (await request<{ workspaces: readonly GitReviewWorkspace[] }>(GIT_REVIEW_WORKSPACES_PATH, signal)).workspaces,
    status: (workspaceId, signal) => request<GitReviewStatus>(`${GIT_REVIEW_STATUS_PATH}?${new URLSearchParams({ workspaceId })}`, signal),
    lastTurn: (workspaceId, signal) => request<GitReviewLastTurnView>(`${GIT_REVIEW_LAST_TURN_PATH}?${new URLSearchParams({ workspaceId })}`, signal),
    diff: ({ workspaceId, category, path, index, commitId, signal }) => {
      const query = new URLSearchParams({ workspaceId, category })
      if (path !== undefined) query.set('path', path)
      if (index !== undefined) query.set('index', String(index))
      if (commitId !== undefined) query.set('commitId', commitId)
      return request<GitReviewDiff>(`${GIT_REVIEW_DIFF_PATH}?${query}`, signal)
    },
  }
}
