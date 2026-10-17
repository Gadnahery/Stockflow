import type { PurchaseOrder } from '../types'

/** PO-2026-0007: next number for this year, continuing from the highest one already used. */
export function nextPoNumber(existing: { poNumber?: string }[], now = new Date()): string {
  const prefix = `PO-${now.getFullYear()}-`
  const max = existing
    .map((p) => p.poNumber)
    .filter((n): n is string => !!n && n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0)
  return prefix + String(max + 1).padStart(4, '0')
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

export function remainingQty(item: PurchaseOrder['items'][number]): number {
  return Math.max(0, round3(item.quantity - (item.received ?? 0)))
}

/**
 * Record goods received against an order. Quantities are clamped to what is still outstanding, so the
 * same delivery can never be received twice. Returns the updated order and what to add to stock.
 */
export function applyReceipt(po: PurchaseOrder, receiveNow: Record<string, number>, nowIso: string) {
  const received: { productId: string; name: string; qty: number; cost: number }[] = []
  const items = po.items.map((i) => {
    const want = round3(Math.max(0, Number(receiveNow[i.productId]) || 0))
    const qty = Math.min(remainingQty(i), want)
    if (qty > 0) received.push({ productId: i.productId, name: i.name, qty, cost: i.cost })
    return { ...i, received: round3((i.received ?? 0) + qty) }
  })
  const complete = items.every((i) => (i.received ?? 0) >= i.quantity)
  const any = items.some((i) => (i.received ?? 0) > 0)
  const updated: PurchaseOrder = {
    ...po,
    items,
    status: complete ? 'received' : any ? 'partial' : po.status,
    receivedAt: complete ? nowIso : po.receivedAt,
    synced: false,
  }
  const value = received.reduce((t, r) => t + r.qty * r.cost, 0)
  return { po: updated, received, value }
}

export const PO_STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partial: 'Part received',
  received: 'Received',
  cancelled: 'Cancelled',
}
