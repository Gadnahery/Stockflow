
import { describe, expect, it } from 'vitest'
import { canWrite, computeAccess } from '../lib/entitlement'
import type { Business } from '../lib/supabase'

const base: Business = { id: 'b1', name: 'Shop' }

describe('entitlement', () => {
  it('allows write during active trial', () => {
    const biz = {
      ...base,
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 3 * 864e5).toISOString(),
    }
    expect(canWrite(biz)).toBe(true)
    expect(computeAccess(biz).status).toBe('trial')
  })

  it('blocks write after trial ends', () => {
    const biz = {
      ...base,
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() - 864e5).toISOString(),
    }
    expect(canWrite(biz)).toBe(false)
    expect(computeAccess(biz).level).toBe('readonly')
  })

  it('allows write when paid', () => {
    const biz = {
      ...base,
      subscription_status: 'active',
      paid_until: new Date(Date.now() + 20 * 864e5).toISOString(),
    }
    expect(canWrite(biz)).toBe(true)
    expect(computeAccess(biz).status).toBe('active')
  })
})
