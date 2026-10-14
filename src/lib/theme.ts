export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = 'sf_theme'

/** Default is always light. Dark only when the user explicitly chooses it. */
export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark') return 'dark'
    if (v === 'light') return 'light'
    // 'system' or anything else → treat as light (no auto dark)
    if (v === 'system') return 'light'
  } catch { /* ignore */ }
  return 'light'
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'dark') return 'dark'
  // light and system both resolve to light — system no longer follows OS
  return 'light'
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  try {
    // Persist only light/dark so we never re-enter system auto mode
    localStorage.setItem(KEY, resolved)
  } catch { /* ignore */ }
}

export function initTheme() {
  // Clear accidental system/dark from older builds unless user chose dark
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'system' || v == null) {
      localStorage.setItem(KEY, 'light')
    }
  } catch { /* ignore */ }
  applyTheme(getStoredTheme())
}
