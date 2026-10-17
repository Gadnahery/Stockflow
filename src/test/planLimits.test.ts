import { describe, expect, it } from 'vitest'
import {
  checkCanAdd,
  computeCheckoutAmount,
  DEFAULT_PLAN_LIMITS,
  resolvePlanLimits,
} from '../lib/planLimits'

describe('plan pricing', () => {
  it('Starter has no extra-branch surcharge', () => {
    const plan = DEFAULT_PLAN_LIMITS.starter
    const r = computeCheckoutAmount(plan, 5)
    expect(r.amountTzs).toBe(25_000)
    expect(r.extraBranches).toBe(4)
    expect(r.surchargeTzs).toBe(0)
  })

  it('Business Pro adds 10k per branch beyond 5', () => {
    const plan = DEFAULT_PLAN_LIMITS.business_pro
    const r = computeCheckoutAmount(plan, 7)
    expect(r.extraBranches).toBe(2)
    expect(r.surchargeTzs).toBe(20_000)
    expect(r.amountTzs).toBe(90_000)
  })

  it('Pro with 5 branches is base only', () => {
    const r = computeCheckoutAmount(DEFAULT_PLAN_LIMITS.business_pro, 5)
    expect(r.surchargeTzs).toBe(0)
    expect(r.amountTzs).toBe(70_000)
  })
})

describe('plan limits', () => {
  it('blocks Starter from a 2nd branch', () => {
    const c = checkCanAdd('branch', 1, DEFAULT_PLAN_LIMITS.starter)
    expect(c.allowed).toBe(false)
    expect(c.grandfathered).toBe(false)
  })

  it('allows Pro beyond 5 branches (billed)', () => {
    const c = checkCanAdd('branch', 6, DEFAULT_PLAN_LIMITS.business_pro)
    expect(c.allowed).toBe(true)
  })

  it('blocks 5th account on Starter', () => {
    const c = checkCanAdd('account', 4, DEFAULT_PLAN_LIMITS.starter)
    expect(c.allowed).toBe(false)
  })

  it('grandfathers shops already over account limit', () => {
    const c = checkCanAdd('account', 6, DEFAULT_PLAN_LIMITS.starter)
    expect(c.allowed).toBe(false)
    expect(c.grandfathered).toBe(true)
  })

  it('resolvePlanLimits merges DB row', () => {
    const p = resolvePlanLimits('growth', { amount_tzs: 45000, max_branches: 3 })
    expect(p.maxAccounts).toBe(12)
    expect(p.amountTzs).toBe(45000)
  })
})
