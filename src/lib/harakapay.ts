/** Client helpers for HarakaPay via our /api proxy (API key never in browser). */

export const MONTHLY_PRICE_TZS = 25_000

export type CollectResult = {
  success: boolean
  order_id?: string
  amount?: number
  message?: string
  error?: string
}

export type StatusResult = {
  success?: boolean
  payment?: {
    order_id?: string
    status?: 'pending' | 'completed' | 'failed' | string
    amount?: number
    net_amount?: number
    fee_amount?: number
  }
  error?: string
}

export async function collectMobilePayment(opts: {
  phone: string
  amount?: number
  description?: string
  businessId?: string
}): Promise<CollectResult> {
  const r = await fetch('/api/harakapay/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: opts.phone,
      amount: opts.amount ?? MONTHLY_PRICE_TZS,
      description: opts.description ?? 'StockFlow subscription — 30 days',
      business_id: opts.businessId,
    }),
  })
  return (await r.json()) as CollectResult
}

export async function checkPaymentStatus(orderId: string): Promise<StatusResult> {
  const r = await fetch(`/api/harakapay/status?order_id=${encodeURIComponent(orderId)}`)
  return (await r.json()) as StatusResult
}

export async function activateSubscription(opts: {
  orderId: string
  businessId: string
  accessToken: string
}): Promise<{ success: boolean; paid_until?: string; error?: string }> {
  const r = await fetch('/api/harakapay/activate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({ order_id: opts.orderId, business_id: opts.businessId }),
  })
  return (await r.json()) as { success: boolean; paid_until?: string; error?: string }
}

export function normalizeTzPhone(input: string): string {
  let p = input.replace(/\s+/g, '').replace(/^\+/, '')
  if (p.startsWith('0') && p.length === 10) p = '255' + p.slice(1)
  return p
}
