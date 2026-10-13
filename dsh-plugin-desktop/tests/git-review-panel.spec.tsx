import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GitReviewPanel, type GitReviewPanelProps } from '../src/client/GitReviewPanel.tsx'

describe('Desktop Git review panel', () => {
  it('renders a loading state until the canonical worktree list is fetched', () => {
    const props = {
      useWorkspaces: (select: (value: { items: never[] }) => unknown) => select({ items: [] }),
      useSessions: (select: (value: { byId: Record<string, never> }) => unknown) => select({ byId: {} }),
      client: { workspaces: vi.fn(), status: vi.fn(), lastTurn: vi.fn(), diff: vi.fn() },
      openFile: vi.fn(),
      t: (key: string) => key,
    } as unknown as GitReviewPanelProps

    const markup = renderToStaticMarkup(createElement(GitReviewPanel, props))
    expect(markup).toContain('role="status"')
    expect(markup).toContain('loading')
  })
})
