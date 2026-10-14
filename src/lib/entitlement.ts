import type { Business } from './supabase'

/**
 * Access is currently based on an authenticated business workspace, not a billing state.
 * Subscription dates and payment metadata are intentionally ignored until the replacement
 * billing system is designed, reviewed, and explicitly enabled.
 */
export type AccessLevel = 'full' | 'unknown'

export interface AccessState {
  level: AccessLevel
  trialDaysLeft: null
  paidUntil: null
  status: 'available' | 'none'
  message: string
}

export function computeAccess(business: Business | null): AccessState {
  if (!business) {
    return { level: 'unknown', trialDaysLeft: null, paidUntil: null, status: 'none', message: '' }
  }
  return {
    level: 'full',
    trialDaysLeft: null,
    paidUntil: null,
    status: 'available',
    message: 'Workspace access available',
  }
}

/** Billing never grants permissions; authenticated membership/role checks remain authoritative. */
export function canWrite(business: Business | null): boolean {
  return Boolean(business)
}
