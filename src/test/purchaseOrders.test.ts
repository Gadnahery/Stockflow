// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { applyReceipt, nextPoNumber, remainingQty } from '../lib/purchaseOrders'
import type { PurchaseOrder } from '../types'

const po = (): PurchaseOrder => ({
  id: 'p1', supplierId: 's1', supplierName: 'Eggs Ltd', status: 'ordered', total: 0, createdAt: '2026-10-17T00:00:00Z', synced: false,
  items: [
    { productId: 'a', name: 'Eggs tray', quantity: 10, cost: 8000 },
    { productId: 'b', name: 'Milk', quantity: 5, cost: 1500 },
  ],
})

describe('purchase orders', () => {
  it('numbers continue from the highest used this year', () => {
    const d = new Date('2026-10-17')
    expect(nextPoNumber([], d)).toBe('PO-2026-0001')
    expect(nextPoNumber([{ poNumber: 'PO-2026-0007' }, { poNumber: 'PO-2025-0099' }, {}], d)).toBe('PO-2026-0008')
  })
  it('partial then full receiving updates status and never over-receives', () => {
    const first = applyReceipt(po(), { a: 4, b: 0 }, 'now')
    expect(first.po.status).toBe('partial')
    expect(first.received).toEqual([{ productId: 'a', name: 'Eggs tray', qty: 4, cost: 8000 }])
    expect(first.value).toBe(32000)
    // try to receive far more than is outstanding: clamped to what is left
    const second = applyReceipt(first.po, { a: 999, b: 999 }, 'later')
    expect(second.received.map((r) => r.qty)).toEqual([6, 5])
    expect(second.po.status).toBe('received')
    expect(second.po.receivedAt).toBe('later')
    // receiving again changes nothing: the same delivery can't be booked twice
    const third = applyReceipt(second.po, { a: 5 }, 'x')
    expect(third.received).toEqual([])
    expect(remainingQty(third.po.items[0])).toBe(0)
  })
})
