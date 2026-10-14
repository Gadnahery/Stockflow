import type { Business } from './supabase'

/**
 * StockFlow is still in beta. Billing is informational only and must not block
 * legitimate business operations while the product is being tested.
 * Flip this single flag to false only when paid plans are ready to launch.
 */
export const BETA_ACCESS_ENABLED = true

export type AccessLevel = 'full' | 'readonly' | 'unknown'

export interface AccessState {
  level: AccessLevel
  trialDaysLeft: number | null
  paidUntil: string | null
  status: string
  message: string
}

export function computeAccess(business: Business | null): AccessState {
  if (!business) {
    return { level: 'unknown', trialDaysLeft: null, paidUntil: null, status: 'none', message: '' }
  }

  // During beta, trial dates and payment state are never allowed to create a paywall.
  if (BETA_ACCESS_ENABLED) {
    return {
      level: 'full',
      trialDaysLeft: null,
      paidUntil: business.paid_until || null,
      status: 'beta',
      message: 'All features are unlocked during beta',
    }
  }

  const status = business.subscription_status || 'trial'
  const now = Date.now()
  const paidUntil = business.paid_until ? new Date(business.paid_until).getTime() : 0
  const trialEnds = business.trial_ends_at ? new Date(business.trial_ends_at).getTime() : 0

  if (status === 'active' && paidUntil > now) {
    return { level: 'full', trialDaysLeft: null, paidUntil: business.paid_until || null, status: 'active', message: 'Subscription active' }
  }

  if (trialEnds > now) {
    const days = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24))
    return { level: 'full', trialDaysLeft: days, paidUntil: null, status: 'trial', message: `${days} day${days === 1 ? '' : 's'} left in trial` }
  }

  return { level: 'readonly', trialDaysLeft: 0, paidUntil: business.paid_until || null, status: status === 'active' ? 'expired' : 'trial_expired', message: 'Trial ended — subscribe to keep editing' }
}

/** Central write-access decision used by the UI and cached device entitlement. */
export function canWrite(business: Business | null): boolean {
  if (BETA_ACCESS_ENABLED && business) return true
  return computeAccess(business).level === 'full'
}
