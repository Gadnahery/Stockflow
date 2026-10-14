/** Subscription plans (TZS / month) — multi-branch & seats scale price */

export type PlanId = 'starter' | 'growth' | 'business'

export interface Plan {
  id: PlanId
  name: string
  nameSw: string
  priceTzs: number
  branches: number | 'unlimited'
  seats: number | 'unlimited'
  features: string[]
  featuresSw: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    nameSw: 'Anza',
    priceTzs: 25_000,
    branches: 1,
    seats: 5,
    features: ['1 branch', 'Up to 5 users', 'POS, stock, reports', 'Offline + sync'],
    featuresSw: ['Tawi 1', 'Watumiaji 5', 'POS, stoo, ripoti', 'Nje ya mtandao'],
  },
  {
    id: 'growth',
    name: 'Growth',
    nameSw: 'Kukuza',
    priceTzs: 45_000,
    branches: 3,
    seats: 15,
    features: ['Up to 3 branches', 'Up to 15 users', 'Everything in Starter', 'Priority support'],
    featuresSw: ['Matawi 3', 'Watumiaji 15', 'Yote ya Anza', 'Msaada wa haraka'],
  },
  {
    id: 'business',
    name: 'Business',
    nameSw: 'Biashara',
    priceTzs: 75_000,
    branches: 'unlimited',
    seats: 'unlimited',
    features: ['Unlimited branches', 'Unlimited users', 'Industry modules', 'Dedicated help'],
    featuresSw: ['Matawi yasiyo na kikomo', 'Watumiaji wasio na kikomo', 'Moduli za sekta', 'Msaada maalum'],
  },
]

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) || PLANS[0]
}
