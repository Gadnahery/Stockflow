import type { Business } from './supabase'
import { readSubscriptionCache, type SubscriptionSummary } from './subscription'

/**
 * Access rules:
 * - Paid (active subscription or paid_until in the future) → full write
 * - Trial still running → full write
 * - Trial ended / no pay → read-only (view only; cannot sell, edit products/stock,
 *   or create customers/suppliers/expenses/purchases — assertCanWrite on those paths too)
 * - Unknown offline with no cache → allow write so POS is not bricked
 */

export type AccessLevel = 'full' | 'readonly' | 'unknown'

export interface AccessState {
  level: AccessLevel
  trialDaysLeft: number | null
  paidUntil: string | null
  status: 'trial' | 'active' | 'expired' | 'none' | 'unknown'
  message: string
}

function daysLeft(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const left = new Date(iso).getTime() - now
  if (left <= 0) return 0
  return Math.max(1, Math.ceil(left / 86_400_000))
}

function isFuture(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false
  return new Date(iso).getTime() > now
}

export function computeAccess(
  business: Business | null,
  sub?: SubscriptionSummary | null,
  now = Date.now(),
): AccessState {
  if (!business) {
    return {
      level: 'unknown',
      trialDaysLeft: null,
      paidUntil: null,
      status: 'none',
      message: '',
    }
  }

  const cached = sub ?? readSubscriptionCache(business.id)
  const paidUntil =
    business.paid_until ||
    (cached?.status === 'active' ? cached.current_period_end : null) ||
    null
  const trialEnds = business.trial_ends_at || cached?.trial_ends_at || null
  const subStatus = business.subscription_status || cached?.status || null

  if (subStatus === 'active' || isFuture(paidUntil, now)) {
    return {
      level: 'full',
      trialDaysLeft: null,
      paidUntil,
      status: 'active',
      message: 'Subscription active',
    }
  }

  if (isFuture(trialEnds, now) || subStatus === 'trial' || subStatus === 'trialing') {
    const d = daysLeft(trialEnds, now)
    if (d !== null && d > 0) {
      return {
        level: 'full',
        trialDaysLeft: d,
        paidUntil: null,
        status: 'trial',
        message: `Trial · ${d} day${d === 1 ? '' : 's'} left`,
      }
    }
  }

  if (
    trialEnds ||
    subStatus === 'trial' ||
    subStatus === 'trialing' ||
    subStatus === 'expired' ||
    subStatus === 'canceled' ||
    cached?.status
  ) {
    return {
      level: 'readonly',
      trialDaysLeft: 0,
      paidUntil,
      status: 'expired',
      message: 'Trial ended — pay to sell and edit again',
    }
  }

  if (!trialEnds && !paidUntil && !subStatus && !cached) {
    return {
      level: 'full',
      trialDaysLeft: null,
      paidUntil: null,
      status: 'unknown',
      message: 'Start your free trial in Billing',
    }
  }

  return {
    level: 'readonly',
    trialDaysLeft: 0,
    paidUntil,
    status: 'expired',
    message: 'Subscription required',
  }
}

export function canWrite(business: Business | null, sub?: SubscriptionSummary | null): boolean {
  return computeAccess(business, sub).level === 'full'
}

export function assertCanWrite(business?: Business | null): void {
  let biz = business
  if (biz === undefined) {
    try {
      biz = JSON.parse(localStorage.getItem('sf_business_cache') || 'null') as Business | null
    } catch {
      biz = null
    }
  }
  if (!biz) return
  const access = computeAccess(biz)
  if (access.level === 'readonly') {
    throw new Error(access.message || 'Trial ended — open Billing to pay and unlock')
  }
}
