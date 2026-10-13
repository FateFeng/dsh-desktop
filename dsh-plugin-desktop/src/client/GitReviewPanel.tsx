import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SidebarPanelIconOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitReviewBranch, GitReviewCommit, GitReviewDiff, GitReviewDiffCategory, GitReviewFile, GitReviewStatus, GitReviewWorkspace } from '../git-review-contract.ts'
import type { GitReviewClient, GitReviewLastTurnView } from './git-review-api.ts'
import { GIT_REVIEW_LOCALE_NAMESPACE } from './git-review-locales.ts'
import css from './GitReview.module.css'

export interface GitReviewPanelInjected {
  readonly client: GitReviewClient
  readonly openFile: (sessionId: SessionId, cwd: string, path: string) => void
}

type Category = 'last-turn' | 'unstaged' | 'untracked' | 'staged' | 'committed' | 'branches'
interface DiffTarget {
  readonly key: string
  readonly category: GitReviewDiffCategory
  readonly path?: string
  readonly index?: number
  readonly commitId?: string
  readonly title: string
}

export type GitReviewPanelProps = PropsRuntime<'main'> & PropsLocale<typeof GIT_REVIEW_LOCALE_NAMESPACE> & InjectFace<GitReviewPanelInjected>

function counts(file: GitReviewFile, t: GitReviewPanelProps['t']): ReactNode {
  return <span className={css.fileCounts}>
    <span className={css.green}>+{file.additions}</span>
    <span className={css.red}>−{file.deletions}</span>
    <span>{file.status}</span>
    <span className="sr-only">{t('additions')}: {file.additions}, {t('deletions')}: {file.deletions}</span>
  </span>
}

function gitFilePath(worktreePath: string, relativePath: string): string {
  return `${worktreePath.replace(/[\\/]+$/u, '')}/${relativePath}`
}

function diffLines(diff: string): readonly string[] {
  return diff.split(/\r?\n/u).filter((line, index, all) => !(index === all.length - 1 && line === ''))
}

function DiffView({ diff, t }: { diff: GitReviewDiff; t: GitReviewPanelProps['t'] }): ReactNode {
  if (diff.turnDiff !== undefined) {
    if (diff.turnDiff.kind !== 'text') return <p className={css.status}>{diff.turnDiff.kind === 'binary' ? t('binary') : t('oversized')}</p>
    const lines = diff.turnDiff.hunks.flatMap(hunk => [
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      ...hunk.lines,
    ])
    return <DiffLines lines={lines} />
  }
  return diff.diff.length > 0 ? <DiffLines lines={diffLines(diff.diff)} /> : <p className={css.status}>{t('noChanges')}</p>
}

function DiffLines({ lines }: { lines: readonly string[] }): ReactNode {
  return <pre className={css.diff}>{lines.map((line, index) => <span key={`${index}:${line}`} className={`${css.diffLine} ${
    line.startsWith('+') && !line.startsWith('+++') ? css.diffAdd
      : line.startsWith('-') && !line.startsWith('---') ? css.diffRemove
        : line.startsWith('@@') ? css.diffHunk : ''
  }`}>{line || ' '}</span>)}</pre>
}

function categoryLabel(category: Category, t: GitReviewPanelProps['t']): string {
  switch (category) {
    case 'last-turn': return t('lastTurn')
    case 'unstaged': return t('unstaged')
    case 'untracked': return t('untracked')
    case 'staged': return t('staged')
    case 'committed': return t('committed')
    case 'branches': return t('branches')
  }
}

function countFor(category: Category, status: GitReviewStatus | undefined, lastTurn: GitReviewLastTurnView | undefined): number {
  switch (category) {
    case 'last-turn': return lastTurn?.files.length ?? 0
    case 'unstaged': return status?.unstaged.length ?? 0
    case 'untracked': return status?.untracked.length ?? 0
    case 'staged': return status?.staged.length ?? 0
    case 'committed': return status?.commits.length ?? 0
    case 'branches': return status?.branches.length ?? 0
  }
}

export function GitReviewPanel({ useSessions, client, openFile, t }: GitReviewPanelProps): ReactNode {
  const sessions = useSessions(snapshot => snapshot.byId)
  const [workspaces, setWorkspaces] = useState<readonly GitReviewWorkspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [category, setCategory] = useState<Category>('last-turn')
  const [status, setStatus] = useState<GitReviewStatus>()
  const [lastTurn, setLastTurn] = useState<GitReviewLastTurnView>()
  const [loading, setLoading] = useState(false)
  const [workspacesLoading, setWorkspacesLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<DiffTarget>()
  const [diff, setDiff] = useState<GitReviewDiff>()
  const [diffLoading, setDiffLoading] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const workspace = workspaces.find(item => item.workspaceId === workspaceId)
  const categories: readonly Category[] = ['last-turn', 'unstaged', 'untracked', 'staged', 'committed', 'branches']

  useEffect(() => {
    const controller = new AbortController()
    setWorkspacesLoading(true)
    void client.workspaces(controller.signal).then(items => {
      if (controller.signal.aborted) return
      setWorkspaces(items)
      setWorkspaceId(current => items.some(item => item.workspaceId === current) ? current : items[0]?.workspaceId ?? '')
      setError('')
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t('error'))
    }).finally(() => { if (!controller.signal.aborted) setWorkspacesLoading(false) })
    return () => { controller.abort() }
  }, [client, refreshVersion, t])

  useEffect(() => {
    if (workspaceId.length === 0 || workspace === undefined || !workspace.repository) {
      setLoading(false)
      setStatus(undefined)
      setLastTurn(undefined)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setStatus(undefined)
    setLastTurn(undefined)
    setTarget(undefined)
    setDiff(undefined)
    void Promise.all([client.status(workspaceId, controller.signal), client.lastTurn(workspaceId, controller.signal)])
      .then(([nextStatus, nextLastTurn]) => {
        if (controller.signal.aborted) return
        setStatus(nextStatus)
        setLastTurn(nextLastTurn)
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t('error'))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort() }
  }, [client, workspace, workspaceId, refreshVersion, t])

  useEffect(() => {
    if (target === undefined) return
    const controller = new AbortController()
    setDiff(undefined)
    setDiffLoading(true)
    void client.diff({ workspaceId, category: target.category, ...(target.path === undefined ? {} : { path: target.path }),
      ...(target.index === undefined ? {} : { index: target.index }), ...(target.commitId === undefined ? {} : { commitId: target.commitId }), signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setDiff(result) })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t('diffUnavailable'))
      })
      .finally(() => { if (!controller.signal.aborted) setDiffLoading(false) })
    return () => { controller.abort() }
  }, [client, target, workspaceId, t])

  const workspaceSessionId = useMemo(() => workspace?.sessionIds.find(id => sessions[id] !== undefined), [sessions, workspace])
  const files: readonly GitReviewFile[] = category === 'last-turn' ? lastTurn?.files ?? []
    : category === 'unstaged' ? status?.unstaged ?? []
      : category === 'untracked' ? status?.untracked ?? []
        : category === 'staged' ? status?.staged ?? [] : []

  useEffect(() => {
    if (target !== undefined) return
    if (category === 'last-turn') {
      const file = lastTurn?.files[0]
      if (lastTurn?.available && file !== undefined) setTarget({ key: `last-turn:0:${file.path}`, category: 'last-turn', path: file.path, index: 0, title: file.display })
      return
    }
    if (category === 'committed') {
      const commit = status?.commits[0]
      if (commit !== undefined) setTarget({ key: `committed:${commit.id}`, category: 'committed', commitId: commit.id, title: commit.subject })
      return
    }
    if (category === 'unstaged' || category === 'untracked' || category === 'staged') {
      const file = category === 'unstaged' ? status?.unstaged[0] : category === 'untracked' ? status?.untracked[0] : status?.staged[0]
      if (file !== undefined) setTarget({ key: `${category}:0:${file.path}`, category, path: file.path, title: file.path })
    }
  }, [category, lastTurn, status, target])

  const selectCategory = (next: Category): void => { setCategory(next); setTarget(undefined); setDiff(undefined); setError('') }
  const selectFile = (file: GitReviewFile, index: number): void => {
    const title = category === 'last-turn' ? (file as import('../git-review-contract.ts').GitReviewLastTurnFile).display : file.path
    setError('')
    setTarget({ key: `${category}:${index}:${file.path}`, category: category as GitReviewDiffCategory, path: file.path, ...(category === 'last-turn' ? { index } : {}), title })
  }

  if (workspaces.length === 0) return <main className={css.root}><p className={css.status} role={workspacesLoading ? 'status' : undefined}>{workspacesLoading ? t('loading') : error || t('noWorkspaces')}</p></main>

  return <main className={css.root} data-desktop-git-review>
    <header className={css.header}>
      <h1 className={css.title}>{t('title')}</h1>
      <select className={css.select} value={workspaceId} aria-label={t('workspace')} onChange={event => { setWorkspaceId(event.currentTarget.value); setCategory('last-turn') }}>
        <option value="" disabled>{t('chooseWorkspace')}</option>
        {workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.workspaceTitle}</option>)}
      </select>
      {status?.repository === true && <div className={css.meta}>
        <span>{t('branch')}: {status.branch ?? '—'}</span>
        <span className={css.green}>{t('ahead')} {status.ahead}</span>
        <span className={css.red}>{t('behind')} {status.behind}</span>
      </div>}
      <button type="button" className={css.openFile} onClick={() => { setRefreshVersion(version => version + 1) }}>{t('refresh')}</button>
    </header>

    <nav className={css.categories} aria-label={t('title')}>
      {categories.map(item => <button key={item} type="button" className={`${css.category} ${category === item ? css.categoryActive : ''}`}
        aria-pressed={category === item} onClick={() => { selectCategory(item) }}>
        {categoryLabel(item, t)}<span className={css.badge}>{countFor(item, status, lastTurn)}</span>
      </button>)}
    </nav>

    {!status && loading && <p className={css.status} role="status">{t('loading')}</p>}
    {!status && error && <p className={css.status} role="alert">{error || t('error')}</p>}
    {workspace !== undefined && !workspace.repository && <p className={css.status}>{t('noRepository')}</p>}
    {category === 'last-turn' && (lastTurn?.omittedFiles ?? 0) > 0 && <p className={css.status} role="note">
      {t('turnFilesOmitted', { shown: String(lastTurn?.files.length ?? 0), total: String(lastTurn?.filesTotal ?? 0), omitted: String(lastTurn?.omittedFiles ?? 0) })}
    </p>}

    {status?.repository === true && <section className={css.content}>
      <div className={css.fileList}>
        {error && <p className={css.status} role="alert">{error}</p>}
        {category === 'last-turn' && lastTurn?.available !== true && <p className={css.status}>{t('noLastTurn')}</p>}
        {category === 'committed' && (status.commits.length === 0
          ? <p className={css.status}>{t('noChanges')}</p>
          : status.commits.map((commit: GitReviewCommit) => <button type="button" key={commit.id}
            className={`${css.fileRow} ${target?.key === `committed:${commit.id}` ? css.fileRowActive : ''}`}
            onClick={() => { setError(''); setTarget({ key: `committed:${commit.id}`, category: 'committed', commitId: commit.id, title: commit.subject }) }}>
            <span className={css.fileName} title={commit.subject}>{commit.subject}</span>
            <span className={css.fileCounts}>{commit.id.slice(0, 8)}</span>
            <small>{commit.author}</small>
          </button>))}
        {category === 'branches' && (status.branches.length === 0
          ? <p className={css.status}>{t('noChanges')}</p>
          : status.branches.map((branch: GitReviewBranch) => <div key={branch.name} className={css.fileRow}>
            <span className={css.fileName}>{branch.name}{branch.current ? ' ✓' : ''}</span>
            {branch.remote && <span>{t('remote')}</span>}
          </div>))}
        {(category === 'last-turn' || category === 'unstaged' || category === 'untracked' || category === 'staged') && files.map((file, index) => {
          const key = `${category}:${index}:${file.path}`
          const display = category === 'last-turn' ? (file as import('../git-review-contract.ts').GitReviewLastTurnFile).display : file.path
          const fileSessionId = category === 'last-turn' ? lastTurn?.sessionId : workspaceSessionId
          const fileSession = fileSessionId === undefined ? undefined : sessions[fileSessionId]
          return <div key={key} className={`${css.fileRow} ${target?.key === key ? css.fileRowActive : ''}`}>
            <button type="button" className={css.fileName} title={display} onClick={() => { selectFile(file, index) }}>{display}</button>
            {counts(file, t)}
            <button type="button" className={css.openFile} disabled={fileSessionId === undefined || fileSession === undefined || workspace === undefined}
              aria-label={`${t('openFile')}: ${display}`} title={fileSessionId === undefined || fileSession === undefined ? t('sessionUnavailable') : t('openFile')}
              onClick={() => {
                if (fileSessionId === undefined || fileSession === undefined || workspace === undefined) return
                const cwd = category === 'last-turn' ? lastTurn?.cwd ?? fileSession.cwd ?? workspace.path : fileSession.cwd ?? workspace.path
                const path = category === 'last-turn' ? file.path : gitFilePath(status?.worktreePath ?? workspace.worktreePath ?? workspace.path, file.path)
                openFile(fileSessionId, cwd, path)
              }}>{t('openFile')}</button>
          </div>
        })}
        {files.length === 0 && category !== 'branches' && category !== 'committed' && category !== 'last-turn' && <p className={css.status}>{t('noChanges')}</p>}
        {category === 'last-turn' && lastTurn?.available === true && files.length === 0 && <p className={css.status}>{t('noChanges')}</p>}
      </div>

      <div className={css.preview}>
        <div className={css.previewHeader}>
          <strong className={css.previewPath}>{target?.title ?? (category === 'committed' ? t('selectCommit') : t('selectFile'))}</strong>
          {target !== undefined && category !== 'committed' && <span className={css.meta}>{counts(files.find(file => file.path === target.path) ?? { path: target.path ?? '', status: '', additions: 0, deletions: 0 }, t)}</span>}
        </div>
        {target === undefined && <p className={css.status}>{category === 'branches' ? t('noChanges') : t('selectFile')}</p>}
        {target !== undefined && diffLoading && <p className={css.status} role="status">{t('loading')}</p>}
        {target !== undefined && diff !== undefined && <DiffView diff={diff} t={t} />}
        {target !== undefined && !diffLoading && diff === undefined && !error && <p className={css.status}>{t('diffUnavailable')}</p>}
      </div>
    </section>}
  </main>
}

export function GitReviewPanelIcon({ size, active }: SidebarPanelIconOwnerProps): ReactNode {
  return <span aria-hidden="true" style={{ width: size, height: size, display: 'grid', placeItems: 'center', borderRadius: 4,
    color: 'currentColor', opacity: active ? 1 : .82, fontWeight: 700, lineHeight: 1 }}>✓</span>
}
