import type { Product } from '../types'

export type ExpiryStatus = 'ok' | 'soon' | 'expired' | 'none'

const DAY_MS = 86_400_000

export function daysUntilExpiry(expiryDate: string | undefined | null, now = new Date()): number | null {
  if (!expiryDate) return null
  const d = new Date(expiryDate.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((d.getTime() - today.getTime()) / DAY_MS)
}

export function expiryStatus(
  expiryDate: string | undefined | null,
  warnDays = 30,
  now = new Date(),
): ExpiryStatus {
  const days = daysUntilExpiry(expiryDate, now)
  if (days == null) return 'none'
  if (days < 0) return 'expired'
  if (days <= warnDays) return 'soon'
  return 'ok'
}

export function isExpired(product: Pick<Product, 'expiryDate'>, now = new Date()): boolean {
  return expiryStatus(product.expiryDate, 30, now) === 'expired'
}

export function isExpiringSoon(
  product: Pick<Product, 'expiryDate'>,
  warnDays = 30,
  now = new Date(),
): boolean {
  return expiryStatus(product.expiryDate, warnDays, now) === 'soon'
}

export function formatExpiryLabel(expiryDate: string | undefined | null, sw = false): string {
  const st = expiryStatus(expiryDate)
  if (st === 'none') return ''
  const days = daysUntilExpiry(expiryDate)
  if (st === 'expired') {
    return sw ? `Imeisha muda (${expiryDate?.slice(0, 10)})` : `Expired (${expiryDate?.slice(0, 10)})`
  }
  if (st === 'soon') {
    return sw
      ? `Inakaribia kuisha · siku ${days}`
      : `Expires in ${days} day${days === 1 ? '' : 's'}`
  }
  return expiryDate?.slice(0, 10) || ''
}

/** Products sorted for FEFO (earliest expiry first; no date last) */
export function sortByFefo<T extends { expiryDate?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0
    if (!a.expiryDate) return 1
    if (!b.expiryDate) return -1
    return a.expiryDate.localeCompare(b.expiryDate)
  })
}
