import type { Business } from './supabase'

export type AccessLevel = 'full' | 'readonly' | 'unknown'

export function computeAccess(business: Business | null): {
  level: AccessLevel
  trialDaysLeft: number | null
  paidUntil: string | null
  status: string
  message: string
} {
  if (!business) {
    return { level: 'unknown', trialDaysLeft: null, paidUntil: null, status: 'none', message: '' }
  }

  const status = business.subscription_status || 'trial'
  const now = Date.now()
  const paidUntil = business.paid_until ? new Date(business.paid_until).getTime() : 0
  const trialEnds = business.trial_ends_at ? new Date(business.trial_ends_at).getTime() : 0

  if (status === 'active' && paidUntil > now) {
    return {
      level: 'full',
      trialDaysLeft: null,
      paidUntil: business.paid_until || null,
      status: 'active',
      message: 'Subscription active',
    }
  }

  if (trialEnds > now) {
    const days = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24))
    return {
      level: 'full',
      trialDaysLeft: days,
      paidUntil: null,
      status: 'trial',
      message: `${days} day${days === 1 ? '' : 's'} left in trial`,
    }
  }

  return {
    level: 'readonly',
    trialDaysLeft: 0,
    paidUntil: business.paid_until || null,
    status: status === 'active' ? 'expired' : 'trial_expired',
    message: 'Trial ended — subscribe to keep editing',
  }
}

export function canWrite(business: Business | null): boolean {
  return computeAccess(business).level === 'full'
}
