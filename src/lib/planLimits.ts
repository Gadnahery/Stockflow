/**
 * Plan limits and pricing (TZS). Pure functions — safe offline.
 * Enforcement must never block selling or product edits.
 */

export type PlanCode = 'starter' | 'growth' | 'business_pro' | string

export interface PlanLimits {
  code: PlanCode
  amountTzs: number
  maxBranches: number
  maxAccounts: number
  /** Stores allowed (Starter=1; higher plans = one per branch) */
  maxStores: number
  /** TZS per branch beyond maxBranches (Pro only, typically 10000) */
  extraBranchPriceTzs: number
}

/** Defaults matching live billing_plans when DB fields missing */
export const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    code: 'starter',
    amountTzs: 25_000,
    maxBranches: 1,
    maxAccounts: 4,
    maxStores: 1,
    extraBranchPriceTzs: 0,
  },
  growth: {
    code: 'growth',
    amountTzs: 45_000,
    maxBranches: 3,
    maxAccounts: 12,
    maxStores: 3,
    extraBranchPriceTzs: 0,
  },
  business_pro: {
    code: 'business_pro',
    amountTzs: 70_000,
    maxBranches: 5,
    maxAccounts: 15,
    maxStores: 5,
    extraBranchPriceTzs: 10_000,
  },
  pro: {
    code: 'pro',
    amountTzs: 70_000,
    maxBranches: 5,
    maxAccounts: 15,
    maxStores: 5,
    extraBranchPriceTzs: 10_000,
  },
}

export function resolvePlanLimits(
  code: string | null | undefined,
  row?: Partial<{
    amount_tzs: number
    max_branches: number
    max_accounts: number
    max_stores: number
    extra_branch_price_tzs: number
  }> | null,
): PlanLimits {
  const key = String(code || 'starter').toLowerCase()
  const base = DEFAULT_PLAN_LIMITS[key] || DEFAULT_PLAN_LIMITS.starter
  return {
    code: key,
    amountTzs: Number(row?.amount_tzs) > 0 ? Number(row?.amount_tzs) : base.amountTzs,
    maxBranches: Number(row?.max_branches) > 0 ? Number(row?.max_branches) : base.maxBranches,
    maxAccounts: Number(row?.max_accounts) > 0 ? Number(row?.max_accounts) : base.maxAccounts,
    maxStores: Number(row?.max_stores) > 0 ? Number(row?.max_stores) : base.maxStores,
    extraBranchPriceTzs:
      row?.extra_branch_price_tzs != null && Number(row.extra_branch_price_tzs) >= 0
        ? Number(row.extra_branch_price_tzs)
        : base.extraBranchPriceTzs,
  }
}

/**
 * Server/client amount: base plan + surcharge for branches beyond included.
 * Pro: max(0, branchCount − maxBranches) × extraBranchPriceTzs
 */
export function computeCheckoutAmount(
  plan: Pick<PlanLimits, 'amountTzs' | 'maxBranches' | 'extraBranchPriceTzs'>,
  branchCount: number,
): { amountTzs: number; extraBranches: number; surchargeTzs: number } {
  const extraBranches = Math.max(0, Math.floor(branchCount) - plan.maxBranches)
  const surchargeTzs =
    plan.extraBranchPriceTzs > 0 ? extraBranches * plan.extraBranchPriceTzs : 0
  return {
    amountTzs: plan.amountTzs + surchargeTzs,
    extraBranches,
    surchargeTzs,
  }
}

export type LimitKind = 'branch' | 'account' | 'store'

export interface LimitCheck {
  allowed: boolean
  /** Business already over limit (grandfathered — don't lock, show banner) */
  grandfathered: boolean
  kind: LimitKind
  current: number
  max: number
  messageEn: string
  messageSw: string
}

/** Adding one more of kind — never used to block POS/sales */
export function checkCanAdd(
  kind: LimitKind,
  currentCount: number,
  plan: PlanLimits,
): LimitCheck {
  const max =
    kind === 'branch' ? plan.maxBranches : kind === 'account' ? plan.maxAccounts : plan.maxStores
  // Pro branches: allow beyond max (billed) when extra price > 0
  if (kind === 'branch' && plan.extraBranchPriceTzs > 0) {
    return {
      allowed: true,
      grandfathered: currentCount > plan.maxBranches,
      kind,
      current: currentCount,
      max: plan.maxBranches,
      messageEn: `Extra branches are billed at ${plan.extraBranchPriceTzs.toLocaleString()} TZS each per month.`,
      messageSw: `Matawi ya ziada yanatozwa ${plan.extraBranchPriceTzs.toLocaleString()} TZS kila moja kwa mwezi.`,
    }
  }
  const alreadyOver = currentCount > max
  const allowed = currentCount < max
  const labels = {
    branch: { en: 'branches', sw: 'matawi' },
    account: { en: 'accounts', sw: 'akaunti' },
    store: { en: 'stores', sw: 'stoo' },
  }
  const L = labels[kind]
  return {
    allowed,
    grandfathered: alreadyOver,
    kind,
    current: currentCount,
    max,
    messageEn: allowed
      ? `${currentCount} of ${max} ${L.en}`
      : alreadyOver
        ? `You already have ${currentCount} ${L.en} (plan includes ${max}). Upgrade when ready — your shop stays open.`
        : `Plan allows ${max} ${L.en}. Upgrade to add more.`,
    messageSw: allowed
      ? `${currentCount} kati ya ${max} ${L.sw}`
      : alreadyOver
        ? `Tayari una ${currentCount} ${L.sw} (mpango unaruhusu ${max}). Boresha baadaye — duka linaendelea.`
        : `Mpango unaruhusu ${L.sw} ${max}. Boresha ili kuongeza.`,
  }
}
