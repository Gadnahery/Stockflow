import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '../lib/db'
import { addBatch, listBatches } from '../lib/batches'
import { usePosStore } from '../store/posStore'
import type { Product } from '../types'

describe('FEFO on completeSale', () => {
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
    await db.settings.put({
      id: 'main',
      businessName: 'Shop',
      currency: 'TZS',
      taxRate: 0,
      taxInclusive: true,
      trackExpiry: true,
      deviceId: 'test',
    } as never)
  })

  it('decrements batch quantity when selling with trackExpiry on', async () => {
    const product: Product = {
      id: 'p1',
      name: 'Paracetamol',
      sku: 'MED1',
      price: 1000,
      cost: 500,
      stock: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.products.put(product)
    await addBatch({
      productId: 'p1',
      productName: 'Paracetamol',
      quantity: 10,
      expiryDate: '2027-06-01',
      location: 'shop',
    })

    usePosStore.getState().clearCart()
    usePosStore.getState().addToCart(product, 2)
    await usePosStore.getState().completeSale([{ method: 'cash', amount: 2000 }])

    const batches = await listBatches('p1', 'shop')
    const total = batches.reduce((s, b) => s + b.quantity, 0)
    expect(total).toBe(8)
    const p = await db.products.get('p1')
    expect(p?.stock).toBe(8)
  })
})
