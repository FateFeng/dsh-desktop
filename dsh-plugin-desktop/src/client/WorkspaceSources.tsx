import { useCallback, useEffect, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-files/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconChevronDownOutlineRegular,
  IconCloseOutlineRegular,
  IconFolderOpenOutlineRegular,
  IconPlusOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  addDesktopWorkspaceSource,
  readDesktopWorkspaceSources,
  updateDesktopWorkspaceSource,
} from './workspace-sources-api.ts'
import type { WorkspaceSourcesResponse } from './workspace-sources-api.ts'
import {
  createWorkspaceRootSelection,
  createWorkspaceSourcesQueue,
  workspaceRootForPath,
} from './workspace-root-selection.ts'
import { createWorkspaceSourcesStore } from './workspace-sources-store.ts'
import type { WorkspaceSourcesStore } from './workspace-sources-store.ts'
import css from './WorkspaceSources.module.css'

type PublishWorkspaceSources = (
  workspacePath: string,
  snapshot: WorkspaceSourcesResponse,
) => void

type LoadWorkspaceSources = (
  workspacePath: string,
  publish: PublishWorkspaceSources,
) => Promise<void>

type MutateWorkspaceSources = (
  workspacePath: string,
  sourcePath: string | undefined,
  publish: PublishWorkspaceSources,
) => Promise<void>

interface WorkspaceSourcesBaseInjected {
  readonly platform: string
  readonly load: LoadWorkspaceSources
}

interface WorkspaceSourcesEditorInjected extends WorkspaceSourcesBaseInjected {
  readonly add: LoadWorkspaceSources
  readonly remove: MutateWorkspaceSources
}

interface WorkspaceSourcesRootActionInjected extends WorkspaceSourcesBaseInjected {
  readonly selectRoot: ReturnType<typeof createWorkspaceRootSelection>
}

export type WorkspaceSourcesEditorProps = PropsRuntime<'sidebar.workspaces.workspace.edit'>
  & PropsLocale<'desktop.settings'>
  & PropsStore<WorkspaceSourcesStore>
  & InjectFace<WorkspaceSourcesEditorInjected>

export type WorkspaceSourcesRootActionProps = PropsRuntime<'sidebar.right.tab.files.actions'>
  & PropsLocale<'desktop.settings'>
  & PropsStore<WorkspaceSourcesStore>
  & InjectFace<WorkspaceSourcesRootActionInjected>

function basename(path: string): string {
  const parts = path.split(/[\\/]/u).filter(Boolean)
  return parts.at(-1) ?? path
}

function displayRoot(path: string, primary: boolean, t: WorkspaceSourcesEditorProps['t']): string {
  const kind = primary ? t('workspaceSourcesPrimary') : t('workspaceSourcesAttached')
  return `${kind} · ${basename(path)}`
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Manage Desktop-owned additional roots from the upstream Workspace Edit modal. */
export function WorkspaceSourcesEditor({
  path, t, actions, platform, useStore, load, add, remove,
}: WorkspaceSourcesEditorProps) {
  const snapshot = useStore(state => state[path])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const publish = actions.publish

  useEffect(() => {
    let active = true
    void load(path, publish).then(() => {
      if (active) setFailure(undefined)
    }).catch(error => {
      if (active) setFailure(describeFailure(error))
    })
    return () => { active = false }
  }, [load, path, publish])

  const mutate = useCallback(async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setFailure(undefined)
    try {
      await operation()
    } catch (error) {
      setFailure(describeFailure(error))
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <section className={css.editor} aria-label={t('workspaceSources')}>
      <div className={css.editorHeader}>
        <h3 className={css.editorTitle}>{t('workspaceSources')}</h3>
        {platform !== 'win32' && (
          <button
            type="button"
            className={css.add}
            disabled={busy || snapshot === undefined}
            onClick={() => { void mutate(() => add(path, publish)) }}
          >
            <span aria-hidden="true"><IconPlusOutlineRegular /></span>
            <span>{t('workspaceSourcesAdd')}</span>
          </button>
        )}
      </div>
      <p className={css.note}>{platform === 'win32'
        ? t('workspaceSourcesWindowsNote')
        : t('workspaceSourcesNote')}</p>
      {snapshot === undefined
        ? <p className={css.status} role="status">{t('workspaceSourcesLoading')}</p>
        : (
          <ul className={css.folderList} aria-label={t('workspaceSourcesList')}>
            <li className={css.folderRow} title={path}>
              <span aria-hidden="true"><IconFolderOpenOutlineRegular className={css.folderIcon} /></span>
              <span className={css.folderName}>{path}</span>
              <span className={css.primary}>{t('workspaceSourcesPrimary')}</span>
            </li>
            {snapshot.sources.map(source => (
              <li key={source} className={css.folderRow} title={source}>
                <span aria-hidden="true"><IconFolderOpenOutlineRegular className={css.folderIcon} /></span>
                <span className={css.folderName}>{source}</span>
                <span className={css.attached}>{t('workspaceSourcesAttached')}</span>
                <button
                  type="button"
                  className={css.detach}
                  aria-label={`${t('workspaceSourcesDetach')}: ${source}`}
                  title={t('workspaceSourcesDetach')}
                  disabled={busy}
                  onClick={() => {
                    void mutate(() => remove(path, source, publish))
                  }}
                >
                  <span aria-hidden="true"><IconCloseOutlineRegular /></span>
                </button>
              </li>
            ))}
            {snapshot.sources.length === 0 && (
              <li className={css.status}>{t('workspaceSourcesEmpty')}</li>
            )}
          </ul>
        )}
      {busy && <p className={css.status} role="status">{t('workspaceSourcesWorking')}</p>}
      {failure !== undefined && (
        <p className={css.error} role="alert">
          {t('workspaceSourcesActionFailed')} <span>{failure}</span>
        </p>
      )}
    </section>
  )
}

/** Switch only the Files tree root; the Workspace identity and Session cwd remain untouched. */
export function WorkspaceSourcesRootAction({
  absolutePath,
  workspacePath,
  onRootChange,
  t,
  actions,
  platform,
  load,
  selectRoot,
  useStore,
}: WorkspaceSourcesRootActionProps) {
  const snapshot = useStore(state => state[workspacePath])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const publish = actions.publish

  useEffect(() => {
    let active = true
    void load(workspacePath, publish).then(() => {
      if (active) setFailure(undefined)
    }).catch(error => {
      if (active) setFailure(describeFailure(error))
    })
    return () => { active = false }
  }, [load, publish, workspacePath])

  const roots = platform === 'win32'
    ? [workspacePath]
    : [workspacePath, ...(snapshot?.sources ?? [])]
  const currentRoot = workspaceRootForPath(absolutePath, roots, platform)
  const selectedRoot = platform !== 'win32' && snapshot !== undefined && roots.includes(snapshot.selectedRoot)
    ? snapshot.selectedRoot
    : workspacePath

  // Host authorization is Workspace-global, so every open and newly opened Files tab
  // follows the same persisted selected root.
  useEffect(() => {
    if (snapshot === undefined || currentRoot === selectedRoot) return
    let active = true
    void onRootChange(selectedRoot).then(() => {
      if (active) setFailure(undefined)
    }).catch(error => {
      if (active) setFailure(describeFailure(error))
    })
    return () => { active = false }
  }, [absolutePath, currentRoot, onRootChange, selectedRoot, snapshot, workspacePath])

  const changeRoot = (root: string): void => {
    setBusy(true)
    setFailure(undefined)
    void selectRoot(workspacePath, root, onRootChange, value => publish(workspacePath, value))
      .catch(error => { setFailure(describeFailure(error)) })
      .finally(() => { setBusy(false) })
  }

  return (
    <>
      <label className={css.rootAction} title={currentRoot ?? workspacePath}>
        <span aria-hidden="true"><IconFolderOpenOutlineRegular className={css.rootActionIcon} /></span>
        <select
          className={css.rootSelect}
          aria-label={t('workspaceSourcesBrowse')}
          value={selectedRoot}
          disabled={busy || snapshot === undefined}
          onChange={event => { changeRoot(event.currentTarget.value) }}
        >
          {roots.map((root, index) => (
            <option key={root} value={root}>
              {displayRoot(root, index === 0, t)} — {root}
            </option>
          ))}
        </select>
        <span aria-hidden="true"><IconChevronDownOutlineRegular className={css.rootActionChevron} /></span>
      </label>
      {busy && <span className={css.status} role="status">{t('workspaceSourcesWorking')}</span>}
      {failure !== undefined && (
        <span className={css.error} role="alert">
          {t('workspaceSourcesActionFailed')} {failure}
        </span>
      )}
    </>
  )
}

export type { WorkspaceSourcesResponse }

/** Register the same source snapshot at the Workspace editor and Files toolbar. */
export function applyDesktopWorkspaceSources(ctx: ClientContext, platform: string): void {
  const store = createWorkspaceSourcesStore()
  const queue = createWorkspaceSourcesQueue()
  const load: LoadWorkspaceSources = (workspacePath, publishSnapshot) =>
    queue(workspacePath, async () => {
      publishSnapshot(workspacePath, await readDesktopWorkspaceSources(workspacePath))
    })
  const add: LoadWorkspaceSources = (workspacePath, publishSnapshot) =>
    queue(workspacePath, async () => {
      publishSnapshot(workspacePath, await addDesktopWorkspaceSource(workspacePath))
    })
  const remove: MutateWorkspaceSources = (workspacePath, sourcePath, publishSnapshot) => {
    if (sourcePath === undefined) return Promise.reject(new Error('missing Workspace source path'))
    return queue(workspacePath, async () => {
      publishSnapshot(workspacePath, await updateDesktopWorkspaceSource('remove', workspacePath, sourcePath))
    })
  }
  const selectRoot = createWorkspaceRootSelection(
    readDesktopWorkspaceSources,
    updateDesktopWorkspaceSource,
    queue,
  )
  const editorInjected = () => ({ platform, load, add, remove })
  const rootActionInjected = () => ({ platform, load, selectRoot })

  ctx.slots.inject('sidebar.workspaces.workspace.edit', () => ctx.slots.register({
    name: 'sidebar.workspaces.workspace.edit',
    locale: 'desktop.settings',
    store,
    inject: editorInjected,
  }, WorkspaceSourcesEditor))
  ctx.slots.inject('sidebar.right.tab.files.actions', () => ctx.slots.register({
    name: 'sidebar.right.tab.files.actions',
    id: 'desktop-workspace-sources',
    order: 100,
    locale: 'desktop.settings',
    store,
    inject: rootActionInjected,
  }, WorkspaceSourcesRootAction))
}