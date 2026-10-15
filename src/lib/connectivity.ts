/** Offline-first connectivity helpers — never trust navigator.onLine alone for long work. */

const CHECK_URL = '/manifest.json'
const DEFAULT_MS = 8000

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/** Race a promise against a timeout so flaky networks never hang the till. */
export function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_MS, label = 'Request'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/**
 * Lightweight reachability check. Returns false quickly when offline or unreachable.
 * Used before outbox push so we don't sit on hung fetch calls.
 */
export async function canReachCloud(ms = 4000): Promise<boolean> {
  if (!isBrowserOnline()) return false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ms)
    const res = await fetch(CHECK_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    return res.ok || res.type === 'opaque'
  } catch {
    return false
  }
}
