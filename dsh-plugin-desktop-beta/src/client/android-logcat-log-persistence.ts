import { ANDROID_LOGCAT_MAX_ENTRIES, makeAndroidLogcatEntry, type AndroidLogcatEntry } from './android-logcat-api.ts'
import type { AndroidLogcatPreferenceStorage } from './android-logcat-preferences.ts'

const LOG_STORAGE_KEY_PREFIX = 'dsh.android-logcat.logs.v1:'
const LOG_STORAGE_VERSION = 1

type AndroidLogcatLogStorage = AndroidLogcatPreferenceStorage & { removeItem?: (key: string) => void }

function getStorage(): AndroidLogcatLogStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function storageKey(serial: string): string {
  return `${LOG_STORAGE_KEY_PREFIX}${encodeURIComponent(serial)}`
}

/** Restore only the bounded log body for one adb serial; corrupt storage is harmless. */
export function readAndroidLogcatEntries(
  serial: string,
  storage: AndroidLogcatPreferenceStorage | undefined = getStorage(),
): AndroidLogcatEntry[] {
  if (!serial || storage === undefined) return []
  try {
    const raw = storage.getItem(storageKey(serial))
    if (raw === null) return []
    const value: unknown = JSON.parse(raw)
    if (!isLogRecord(value)) return []
    const lines = value.lines.slice(-ANDROID_LOGCAT_MAX_ENTRIES)
    return lines.map((line, index) => makeAndroidLogcatEntry(line, index + 1))
  } catch {
    return []
  }
}

/** Persist the current bounded log body; storage failures must never break streaming. */
export function writeAndroidLogcatEntries(
  serial: string,
  entries: readonly AndroidLogcatEntry[],
  storage: AndroidLogcatPreferenceStorage | undefined = getStorage(),
): void {
  if (!serial || storage === undefined) return
  try {
    storage.setItem(storageKey(serial), JSON.stringify({
      version: LOG_STORAGE_VERSION,
      lines: entries.slice(-ANDROID_LOGCAT_MAX_ENTRIES).map(entry => entry.raw),
    }))
  } catch {
    // Private browsing, quota limits, or disabled storage must not break Logcat.
  }
}

/** Delete persisted logs only when the user explicitly clears the Logcat body. */
export function clearAndroidLogcatEntries(
  serial: string,
  storage: AndroidLogcatLogStorage | undefined = getStorage(),
): void {
  if (!serial || storage?.removeItem === undefined) return
  try {
    storage.removeItem(storageKey(serial))
  } catch {
    // Private browsing, quota limits, or disabled storage must not break Logcat.
  }
}

function isLogRecord(value: unknown): value is { version: number; lines: string[] } {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as { version?: unknown }).version === LOG_STORAGE_VERSION
    && Array.isArray((value as { lines?: unknown }).lines)
    && (value as { lines: unknown[] }).lines.every(line => typeof line === 'string')
}
