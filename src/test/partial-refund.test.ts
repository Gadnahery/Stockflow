import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '../lib/db'
import { usePosStore } from '../store/posStore'
import type { Product, Sale } from '../types'

describe('partial refund', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    localStorage.setItem(
      'sf_business_cache',
      JSON.stringify({
        id: 'biz1',
        name: 'Shop',
        subscription_status: 'active',
        paid_until: new Date(Date.now() + 30 * 864e5).toISOString(),
      }),
    )
  })

  it('restocks only selected line quantities', async () => {
    const product: Product = {
      id: 'p1',
      name: 'Eggs',
      sku: 'E1',
      price: 400,
      cost: 300,
      stock: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.products.put(product)
    const sale: Sale = {
      id: 's1',
      receiptNumber: 'R-1',
      items: [
        {
          productId: 'p1',
          name: 'Eggs',
          sku: 'E1',
          price: 400,
          quantity: 5,
          discount: 0,
          lineTotal: 2000,
          stockUnits: 5,
        },
      ],
      subtotal: 2000,
      tax: 0,
      discount: 0,
      total: 2000,
      payments: [{ method: 'cash', amount: 2000 }],
      status: 'completed',
      cashierId: 'u1',
      cashierName: 'Cashier',
      deviceId: 'd1',
      createdAt: new Date().toISOString(),
      synced: false,
    }
    await db.sales.put(sale)

    await usePosStore.getState().refundSale('s1', {
      restock: true,
      lineQty: { p1: 2 },
    })

    const updated = await db.products.get('p1')
    expect(updated?.stock).toBe(12) // 10 + 2
    const s = await db.sales.get('s1')
    expect(s?.status).toBe('refunded')
    expect(s?.refundAmount).toBe(800)
  })
})
