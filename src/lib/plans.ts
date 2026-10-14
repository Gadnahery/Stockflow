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
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    nameSw: 'Anza',
    priceTzs: 25_000,
    branches: 1,
    seats: 5,
    features: [
      '1 shop / branch',
      'Up to 5 staff (PIN)',
      'POS + stock + customers',
      'Jumla & reja reja units',
      'Offline sales + sync',
      'Reports & net profit',
    ],
    featuresSw: [
      'Duka / tawi 1',
      'Wafanyakazi 5 (PIN)',
      'POS + stoo + wateja',
      'Jumla na reja reja',
      'Mauzo nje ya mtandao',
      'Ripoti na faida',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    nameSw: 'Kukuza',
    priceTzs: 45_000,
    branches: 3,
    seats: 15,
    highlight: true,
    features: [
      'Up to 3 branches',
      'Up to 15 staff',
      'Everything in Starter',
      'Multi-branch stock view',
      'Priority chat support',
    ],
    featuresSw: [
      'Matawi hadi 3',
      'Wafanyakazi 15',
      'Yote ya Anza',
      'Stoo kwa matawi',
      'Msaada wa haraka',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    nameSw: 'Biashara',
    priceTzs: 75_000,
    branches: 'unlimited',
    seats: 'unlimited',
    features: [
      'Unlimited branches',
      'Unlimited staff',
      'Industry modules (pharmacy, restaurant, liquor)',
      'Advanced roles & audit',
      'Dedicated onboarding help',
    ],
    featuresSw: [
      'Matawi yasiyo na kikomo',
      'Wafanyakazi wasio na kikomo',
      'Moduli (duka dawa, mgahawa, pombe)',
      'Majukumu na ukaguzi',
      'Msaada wa kuanzisha',
    ],
  },
]

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) || PLANS[0]
}
