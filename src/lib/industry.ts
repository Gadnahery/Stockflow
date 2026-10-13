/** Industry modules (SRS §8) — feature flags driven by settings.industryType */

export type IndustryType =
  | 'retail'
  | 'restaurant'
  | 'pharmacy'
  | 'liquor'
  | 'salon'
  | 'wholesale'

export const INDUSTRY_OPTIONS: {
  id: IndustryType
  label: string
  labelSw: string
  description: string
  descriptionSw: string
}[] = [
  {
    id: 'retail',
    label: 'Retail / general shop',
    labelSw: 'Duka la rejareja',
    description: 'Standard POS, stock, barcodes, multi-branch.',
    descriptionSw: 'POS ya kawaida, stoo, barcode, matawi.',
  },
  {
    id: 'wholesale',
    label: 'Wholesale',
    labelSw: 'Jumla',
    description: 'Bulk pricing hints, credit-focused customers.',
    descriptionSw: 'Bei za wingi, wateja wa mkopo.',
  },
  {
    id: 'restaurant',
    label: 'Restaurant / café',
    labelSw: 'Mgahawa',
    description: 'Tables, open orders, kitchen ticket style notes.',
    descriptionSw: 'Meza, oda wazi, noti za jikoni.',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    labelSw: 'Duka la dawa',
    description: 'Batch/lot, expiry (FEFO), restricted-item audit notes.',
    descriptionSw: 'Batch, muda wa kuisha, dawa nyeti.',
  },
  {
    id: 'liquor',
    label: 'Liquor store',
    labelSw: 'Duka la pombe',
    description: 'Age-check reminder at checkout, restricted categories.',
    descriptionSw: 'Ukumbusho wa umri kwenye malipo.',
  },
  {
    id: 'salon',
    label: 'Salon / services',
    labelSw: 'Saluni / huduma',
    description: 'Service items without stock deduction optional.',
    descriptionSw: 'Huduma bila kupunguza stoo.',
  },
]

export function featuresFor(industry: IndustryType | undefined | null) {
  const i = industry || 'retail'
  return {
    industry: i,
    tables: i === 'restaurant',
    batches: i === 'pharmacy',
    expiryAlerts: i === 'pharmacy',
    ageCheck: i === 'liquor',
    servicesNoStock: i === 'salon' || i === 'restaurant',
    bulkTiers: i === 'wholesale',
    kotNotes: i === 'restaurant',
  }
}
