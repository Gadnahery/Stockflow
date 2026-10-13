/** Lightweight EN / SW locale. Default English. Persists to localStorage. */

export type Locale = 'en' | 'sw'

const KEY = 'sf_locale'

export function getStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'sw' || v === 'en') return v
  } catch {
    /* ignore */
  }
  return 'en'
}

export function setStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(KEY, locale)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'sw' ? 'sw' : 'en'
  }
}

export function applyDocumentLang(locale: Locale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'sw' ? 'sw' : 'en'
  }
}
