import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { describe, expect, it, vi } from 'vitest'
import { fileAddressFor, sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { GitReviewPanel, gitReviewFileOpenCoordinates, type GitReviewPanelProps } from '../src/client/GitReviewPanel.tsx'
import { createGitReviewTabDefinition } from '../src/client/git-review-tab.ts'

describe('Desktop Git Review Guide page', () => {
  it('contributes a peer Review card that opens its Session-scoped page', () => {
    const definition = createGitReviewTabDefinition(key => key)
    expect(definition).toMatchObject({
      id: 'desktop-git-review',
      kind: 'desktop-git-review',
      priority: 'builtin',
      guide: [{ id: 'review', order: 40 }],
    })
    expect(definition.guide?.[0]?.title()).toBe('guideTitle')
    expect(definition.guide?.[0]?.description?.()).toBe('guideDescription')
  })

  it('addresses files relative to the selected root for nested and attached roots', () => {
    const sessionId = 'session-1' as SessionId
    for (const root of ['/home/fate/project/nested-root', '/mnt/shared/project']) {
      const coordinates = gitReviewFileOpenCoordinates(root, 'src/file.ts')
      expect(fileAddressFor(sessionId, coordinates.cwd, coordinates.path))
        .toBe(sessionFileAddress(sessionId, 'src/file.ts'))
    }
  })

  it('renders a loading state while the owner Session Workspace is resolved', () => {
    const props = {
      sessionId: 'session-1' as SessionId,
      useSessions: (select: (value: { byId: Record<string, never> }) => unknown) => select({ byId: {} }),
      client: { workspace: vi.fn(), status: vi.fn(), commitFiles: vi.fn(), lastTurn: vi.fn(), diff: vi.fn() },
      openFile: vi.fn(),
      platform: 'linux',
      t: (key: string) => key,
    } as unknown as GitReviewPanelProps

    const markup = renderToStaticMarkup(createElement(GitReviewPanel, props))
    expect(markup).toContain('role="status"')
    expect(markup).toContain('loading')
  })
})
