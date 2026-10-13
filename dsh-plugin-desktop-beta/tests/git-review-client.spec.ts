import { afterEach, describe, expect, it, vi } from 'vitest'
import { GIT_REVIEW_DIFF_PATH, GIT_REVIEW_LAST_TURN_PATH, GIT_REVIEW_STATUS_PATH } from '../src/git-review-contract.ts'
import { createGitReviewClient } from '../src/client/git-review-api.ts'

afterEach(() => { vi.unstubAllGlobals() })

describe('Desktop Git review client', () => {
  it('queries the three review views with encoded workspace and file data', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ available: true, files: [] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createGitReviewClient()
    const signal = new AbortController().signal

    await client.status('workspace / one', signal)
    await client.lastTurn('workspace / one', signal)
    await client.diff({ workspaceId: 'workspace / one', category: 'unstaged', path: 'src/file with space.ts', signal })

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${GIT_REVIEW_STATUS_PATH}?workspaceId=workspace+%2F+one`, {
      method: 'GET', signal, headers: { accept: 'application/json' },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${GIT_REVIEW_LAST_TURN_PATH}?workspaceId=workspace+%2F+one`, {
      method: 'GET', signal, headers: { accept: 'application/json' },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3,
      `${GIT_REVIEW_DIFF_PATH}?workspaceId=workspace+%2F+one&category=unstaged&path=src%2Ffile+with+space.ts`, {
        method: 'GET', signal, headers: { accept: 'application/json' },
      })
  })

  it('surfaces safe Host errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Git was not found on PATH.', code: 'git-not-found' }), {
      status: 503, headers: { 'content-type': 'application/json' },
    })))
    await expect(createGitReviewClient().status('workspace-1', new AbortController().signal))
      .rejects.toThrow('Git was not found on PATH.')
  })
})
