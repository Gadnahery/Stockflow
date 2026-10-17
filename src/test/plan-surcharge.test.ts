import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAN_LIMITS, resolvePlanLimits } from '../lib/planLimits'

/** amount = plan.amount + max(0, branchCount − max_branches) × extra_branch_price */
function billedAmount(planCode: string, branchCount: number): number {
  const lim = resolvePlanLimits(planCode)
  const extra = Math.max(0, branchCount - lim.maxBranches) * lim.extraBranchPriceTzs
  return lim.amountTzs + extra
}

describe('Business Pro extra-branch surcharge', () => {
  it('no surcharge within branch limit', () => {
    expect(billedAmount('business_pro', 5)).toBe(DEFAULT_PLAN_LIMITS.business_pro.amountTzs)
  })
  it('adds 10k TZS per branch beyond max', () => {
    expect(billedAmount('business_pro', 7)).toBe(70_000 + 2 * 10_000)
  })
  it('starter has no extra-branch price', () => {
    expect(billedAmount('starter', 3)).toBe(DEFAULT_PLAN_LIMITS.starter.amountTzs)
  })
})
