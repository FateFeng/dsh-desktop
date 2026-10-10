const STYLE_ID = 'dsh-android-logcat-styles'

const CSS = `
.dshAndroidLogcatLauncher { width: max-content; max-width: 100%; min-width: 0; align-self: flex-start; justify-content: flex-start; margin-inline-start: 0; padding-inline: 0; }
.dshAndroidLogcatDrawer {
  position: absolute;
  z-index: 2147483000;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  box-sizing: border-box;
  height: min(var(--dsh-android-logcat-height), 88vh, calc(100% - 8px));
  max-height: calc(100% - 8px);
  min-height: 180px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .35));
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: #11191d;
  color: var(--dsw-alias-label-primary, #e8e9eb);
  box-shadow: 0 -12px 40px rgba(0, 0, 0, .24);
  font: var(--dsh-android-logcat-ui-font-size, 12px)/1.45 var(--dsw-font-family, system-ui, sans-serif);
  pointer-events: auto;
}
.dshAndroidLogcatDrawer[data-collapsed="true"] {
  height: 42px;
  min-height: 42px;
}
.dshAndroidLogcatResizeHandle {
  position: absolute;
  z-index: 1;
  top: -3px;
  right: 0;
  left: 0;
  height: 8px;
  cursor: ns-resize;
  touch-action: none;
}
.dshAndroidLogcatResizeHandle::after {
  position: absolute;
  top: 3px;
  left: calc(50% - 18px);
  width: 36px;
  height: 3px;
  border-radius: 4px;
  background: var(--dsw-alias-border-l1, #555);
  content: "";
}
.dshAndroidLogcatResizeHandle:hover::after,
.dshAndroidLogcatResizeHandle:focus-visible::after { background: var(--dsw-alias-brand-primary, #7b8cff); }
.dshAndroidLogcatResizeHandle:focus-visible { outline: none; }
.dshAndroidLogcatHeader {
  display: flex;
  box-sizing: border-box;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 12px 5px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .28));
  background: #1b292e;
  user-select: none;
}
.dshAndroidLogcatHeading { display: flex; min-width: 0; align-items: baseline; gap: 10px; }
.dshAndroidLogcatHeading strong { overflow: hidden; font-size: 1.08em; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.dshAndroidLogcatHeading > span { overflow: hidden; color: var(--dsw-alias-label-secondary, #a4a7ad); text-overflow: ellipsis; white-space: nowrap; }
.dshAndroidLogcatStatus { color: var(--dsw-alias-state-success-primary, #67c587) !important; }
.dshAndroidLogcatStatus[data-state="paused"] { color: var(--dsw-alias-state-warning-primary, #e8b45c) !important; }
.dshAndroidLogcatHeaderActions { display: flex; flex: 0 0 auto; align-items: center; gap: 4px; }
.dshAndroidLogcatIconButton,
.dshAndroidLogcatButton {
  display: inline-flex;
  min-height: 28px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .35));
  border-radius: 6px;
  background: #1b292e;
  color: inherit;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}
.dshAndroidLogcatIconButton { width: 28px; padding: 0; border-color: transparent; background: transparent; font-size: 18px; }
.dshAndroidLogcatIconButton:hover,
.dshAndroidLogcatButton:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, .16)); }
.dshAndroidLogcatButton:disabled { cursor: not-allowed; opacity: .5; }
.dshAndroidLogcatButton:focus-visible,
.dshAndroidLogcatIconButton:focus-visible,
.dshAndroidLogcatField select:focus-visible,
.dshAndroidLogcatPatternField input:focus-visible,
.dshAndroidLogcatDisplayField select:focus-visible,
.dshAndroidLogcatFollowToggle input:focus-visible,
.dshAndroidLogcatTipsToggle input:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, #7b8cff);
  outline-offset: 1px;
}
.dshAndroidLogcatPrimaryButton { border-color: transparent; background: var(--dsw-alias-brand-primary, #556bd6); color: #fff; }
.dshAndroidLogcatToolbar {
  display: flex;
  min-height: 42px;
  flex: 0 0 auto;
  align-items: end;
  flex-wrap: wrap;
  gap: 7px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .25));
  background: #10181c;
}
.dshAndroidLogcatField,
.dshAndroidLogcatPatternField { display: flex; min-width: 110px; flex: 0 1 205px; flex-direction: column; gap: 3px; }
.dshAndroidLogcatField > span,
.dshAndroidLogcatPatternField > span:first-child { color: var(--dsw-alias-label-secondary, #a4a7ad); font-size: .83em; }
.dshAndroidLogcatField select,
.dshAndroidLogcatPatternField input {
  width: 100%;
  height: 28px;
  box-sizing: border-box;
  padding: 3px 8px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .4));
  border-radius: 6px;
  background: #10181c;
  color: inherit;
  font: inherit;
}
.dshAndroidLogcatField select:disabled { opacity: .55; }
.dshAndroidLogcatProcessField { flex-basis: 225px; }
.dshAndroidLogcatSeverityField { flex-basis: 125px; }
.dshAndroidLogcatFilterBar { align-items: flex-end; }
.dshAndroidLogcatPatternField { min-width: 170px; flex: 1 1 190px; }
.dshAndroidLogcatPatternField input[aria-invalid="true"] { border-color: var(--dsw-alias-state-error-primary, #ed7373); }
.dshAndroidLogcatFollowToggle { display: inline-flex; min-height: 28px; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary, #a4a7ad); white-space: nowrap; }
.dshAndroidLogcatFollowToggle input { accent-color: var(--dsw-alias-brand-primary, #7b8cff); }
.dshAndroidLogcatMultiFilter { position: relative; flex: 0 0 auto; }
.dshAndroidLogcatMultiFilter summary { display: flex; min-height: 28px; box-sizing: border-box; align-items: center; padding: 4px 9px; border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .4)); border-radius: 6px; background: #10181c; cursor: pointer; list-style: none; white-space: nowrap; }
.dshAndroidLogcatMultiFilter summary::-webkit-details-marker { display: none; }
.dshAndroidLogcatMultiFilter[data-disabled] summary { cursor: not-allowed; opacity: .55; }
.dshAndroidLogcatMultiFilterMenu { position: absolute; z-index: 5; top: calc(100% + 4px); left: 0; display: flex; min-width: 190px; max-height: 240px; flex-direction: column; gap: 2px; overflow: auto; padding: 6px; border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .4)); border-radius: 7px; background: #11191d; box-shadow: 0 8px 24px rgba(0, 0, 0, .5); }
.dshAndroidLogcatMultiFilterMenu label { display: flex; min-height: 26px; align-items: center; gap: 7px; padding: 2px 5px; border-radius: 4px; cursor: pointer; }
.dshAndroidLogcatMultiFilterMenu label:hover { background: #1b292e; }
.dshAndroidLogcatMultiFilterMenu input { accent-color: var(--dsw-alias-brand-primary, #7b8cff); }
.dshAndroidLogcatMultiFilterMenu span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshAndroidLogcatDisplaySettings { display: flex; flex: 0 0 auto; align-items: center; flex-wrap: wrap; gap: 8px 14px; padding: 5px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .2)); background: #10181c; }
.dshAndroidLogcatDisplayField { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary, #a4a7ad); }
.dshAndroidLogcatDisplayField select { min-height: 26px; padding: 2px 6px; border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .4)); border-radius: 5px; background: #10181c; color: inherit; font: inherit; }
.dshAndroidLogcatTipsToggle { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary, #a4a7ad); cursor: pointer; }
.dshAndroidLogcatTipsToggle input { accent-color: var(--dsw-alias-brand-primary, #7b8cff); }
.dshAndroidLogcatFilterHelp { display: flex; flex: 0 0 auto; flex-direction: column; gap: 2px; padding: 3px 12px 6px; color: var(--dsw-alias-label-secondary, #9299a1); font-size: .83em; }
.dshAndroidLogcatFilterHelp[hidden] { display: none; }
.dshAndroidLogcatFilterHelp strong { color: var(--dsw-alias-label-primary, #c5cbd0); font-size: 1.1em; }
.dshAndroidLogcatFilterError { margin: 0; padding: 0; color: var(--dsw-alias-state-error-primary, #ed7373) !important; font-size: .83em; font-weight: 500; }
.dshAndroidLogcatScreenshotBackdrop { position: fixed; z-index: 2147483647; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, .82); }
.dshAndroidLogcatScreenshotDialog { display: flex; width: min(900px, 96vw); max-height: 94vh; flex-direction: column; overflow: hidden; border: 1px solid #3c4a4e; border-radius: 10px; background: #11191d; box-shadow: 0 18px 60px rgba(0, 0, 0, .7); color: #e8e9eb; }
.dshAndroidLogcatScreenshotDialog header,
.dshAndroidLogcatScreenshotDialog footer { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: #1b292e; }
.dshAndroidLogcatScreenshotDialog img { min-height: 0; max-width: 100%; flex: 1 1 auto; object-fit: contain; }
.dshAndroidLogcatScreenshotDialog footer { justify-content: flex-end; }
.dshAndroidLogcatScreenshotDialog a { text-decoration: none; }
.dshAndroidLogcatAlerts { display: flex; flex: 0 0 auto; flex-direction: column; gap: 3px; padding: 6px 12px 0; }
.dshAndroidLogcatAlerts p,
.dshAndroidLogcatEmptyHint { margin: 0; color: var(--dsw-alias-label-secondary, #a4a7ad); }
.dshAndroidLogcatAlerts p[role="alert"] { color: var(--dsw-alias-state-error-primary, #ed7373); }
.dshAndroidLogcatAlerts p[role="status"] { color: var(--dsw-alias-state-warning-primary, #e8b45c); }
.dshAndroidLogcatEmptyHint { flex: 0 0 auto; padding: 10px 12px; }
.dshAndroidLogcatLogList {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  padding: 4px 0;
  background: #10181c;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
  font: var(--dsh-android-logcat-log-font-size, 12px)/1.55 var(--dsw-mono-font-family, ui-monospace, SFMono-Regular, Consolas, monospace);
}
.dshAndroidLogcatLogRow { display: flex; width: 100%; min-width: 0; align-items: flex-start; flex-wrap: wrap; gap: 3px 10px; box-sizing: border-box; padding: 2px 12px; color: var(--dsw-alias-label-secondary, #b0b2b7); }
.dshAndroidLogcatLogRow code { min-width: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
.dshAndroidLogcatLogRow > code:only-child { flex: 1 1 100%; }
.dshAndroidLogcatTimestamp { flex: 0 1 150px; min-width: 110px; color: #92a4aa; }
.dshAndroidLogcatLogMeta { flex: 0 1 80px; min-width: 55px; padding: 0; border: 0; background: transparent; color: #aab6ba; cursor: pointer; font: inherit; text-align: left; }
.dshAndroidLogcatLevel { flex: 0 0 30px; font-weight: 700; }
.dshAndroidLogcatLogTag { flex: 0 1 180px; min-width: 90px; overflow: hidden; padding: 0; border: 0; background: transparent; color: #8eb4ff; cursor: pointer; font: inherit; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.dshAndroidLogcatMessage { flex: 1 1 240px; min-width: 0; color: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
.dshAndroidLogcatLogRow[data-level="verbose"] { color: var(--dsw-alias-label-secondary, #a9adb5); }
.dshAndroidLogcatLogRow[data-level="debug"] { color: var(--dsw-alias-label-primary, #c0c8e8); }
.dshAndroidLogcatLogRow[data-level="info"] { color: var(--dsw-alias-state-success-primary, #78c98f); }
.dshAndroidLogcatLogRow[data-level="warn"] { color: var(--dsw-alias-state-warning-primary, #e8b45c); }
.dshAndroidLogcatLogRow[data-level="error"] { color: var(--dsw-alias-state-error-primary, #ed7373); }
.dshAndroidLogcatFooter { display: flex; min-height: 22px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 2px 12px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, .25)); color: var(--dsw-alias-label-secondary, #a4a7ad); font-size: .83em; }
@media (max-width: 720px) {
  .dshAndroidLogcatDrawer { height: min(var(--dsh-android-logcat-height), 92vh, calc(100% - 8px)); max-height: calc(100% - 8px); border-radius: 8px 8px 0 0; }
  .dshAndroidLogcatToolbar { align-items: stretch; }
  .dshAndroidLogcatField { flex: 1 1 140px; }
  .dshAndroidLogcatProcessField { flex-basis: 170px; }
  .dshAndroidLogcatFilterBar { gap: 5px; }
  .dshAndroidLogcatFilterBar > .dshAndroidLogcatButton { padding-inline: 6px; }
  .dshAndroidLogcatHeading > span:not(.dshAndroidLogcatStatus) { display: none; }
}
@media (prefers-reduced-motion: no-preference) {
  .dshAndroidLogcatDrawer { transition: height 120ms ease; }
}
`

/** Install one plugin-owned stylesheet and return its lifecycle disposer. */
export function installAndroidLogcatStyles(owner: string): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.getElementById(STYLE_ID)
  if (existing !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset.plugin = owner
  style.dataset.pluginCss = `${owner}/android-logcat`
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}
