import { describe, expect, it } from 'vitest'
import { assertCanWrite, computeAccess, type AccessState } from '../lib/entitlement'
import type { Business } from '../lib/supabase'

/** Same rules BillingPage uses for status copy — must match assertCanWrite. */
function billingStatusCopy(access: AccessState, periodEnd: string | null, trialEnd: string | null): string {
  if (access.level === 'full' && access.status === 'active') {
    return 'Active plan · current period ends ' + (periodEnd || access.paidUntil || '—')
  }
  if (access.level === 'full' && access.status === 'trial') {
    return '7-day trial · ends ' + (trialEnd || '—')
  }
  if (access.level === 'readonly') {
    return 'Trial ended. You can still sign in and view data, but selling and editing stay locked until you pay.'
  }
  return access.message || 'Start a free trial or choose a plan when you are ready.'
}

function claimsUnlocked(copy: string): boolean {
  return /does not lock|remains available|Selling stays available|Mauzo yanaendelea/i.test(copy)
}

describe('Billing messaging matches entitlement', () => {
  const now = Date.parse('2026-10-18T12:00:00Z')

  it('active subscription: full write + no lock language', () => {
    const biz = {
      id: 'b1',
      name: 'Shop',
      subscription_status: 'active',
      paid_until: '2026-11-18T00:00:00Z',
    } as Business
    const access = computeAccess(biz, null, now)
    expect(access.level).toBe('full')
    expect(() => assertCanWrite(biz)).not.toThrow()
    const copy = billingStatusCopy(access, (biz.paid_until ?? null), null)
    expect(claimsUnlocked(copy)).toBe(false)
    expect(copy).toMatch(/Active plan/)
  })

  it('running trial: full write + trial copy', () => {
    const biz = {
      id: 'b1',
      name: 'Shop',
      subscription_status: 'trialing',
      trial_ends_at: '2026-10-24T00:00:00Z',
    } as Business
    const access = computeAccess(biz, null, now)
    expect(access.level).toBe('full')
    expect(() => assertCanWrite(biz)).not.toThrow()
    const copy = billingStatusCopy(access, null, (biz.trial_ends_at ?? null))
    expect(claimsUnlocked(copy)).toBe(false)
    expect(copy).toMatch(/trial/i)
  })

  it('expired trial: readonly + must not claim nothing is locked', () => {
    const biz = {
      id: 'b1',
      name: 'Shop',
      subscription_status: 'trialing',
      trial_ends_at: '2026-10-10T00:00:00Z',
    } as Business
    const access = computeAccess(biz, null, now)
    expect(access.level).toBe('readonly')
    expect(() => assertCanWrite(biz)).toThrow(/locked|pay|Trial ended/i)
    const copy = billingStatusCopy(access, null, (biz.trial_ends_at ?? null))
    expect(claimsUnlocked(copy)).toBe(false)
    expect(copy).toMatch(/locked until you pay/i)
  })
})
