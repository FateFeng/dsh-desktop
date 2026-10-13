import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { GIT_REVIEW_TAB_ID, GIT_REVIEW_TAB_KIND } from './GitReviewPanel.tsx'
import type { GitReviewLocaleKey } from './git-review-locales.ts'

/** Start-page card and page identity for Session-scoped Git Review. */
export function createGitReviewTabDefinition(t: (key: GitReviewLocaleKey) => string): SidebarRightTabDefinition {
  return {
    id: GIT_REVIEW_TAB_ID,
    kind: GIT_REVIEW_TAB_KIND,
    priority: 'builtin',
    title: () => t('title'),
    guide: [{ id: 'review', order: 40, title: () => t('guideTitle'), description: () => t('guideDescription') }],
  }
}
