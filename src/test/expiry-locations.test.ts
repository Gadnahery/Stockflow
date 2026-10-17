import { describe, expect, it } from 'vitest'
import {
  daysUntilExpiry,
  expiryStatus,
  isExpired,
  formatExpiryLabel,
  sortByFefo,
} from '../lib/expiry'
import { locationLabel, shopQty, storeQty } from '../lib/locations'
import { nextInvoiceNumber } from '../lib/invoice'
import { addBatch, listBatches, deductFefo } from '../lib/batches'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'

describe('expiry', () => {
  it('detects expired and soon', () => {
    const past = '2020-01-01'
    const future = '2099-06-01'
    expect(isExpired({ expiryDate: past })).toBe(true)
    expect(isExpired({ expiryDate: future })).toBe(false)
    expect(expiryStatus(past)).toBe('expired')
    expect(expiryStatus(future)).toBe('ok')
  })

  it('daysUntilExpiry for today is 0', () => {
    const today = new Date()
    const iso = today.toISOString().slice(0, 10)
    expect(daysUntilExpiry(iso)).toBe(0)
    expect(expiryStatus(iso, 30)).toBe('soon')
  })

  it('sortByFefo puts earliest first', () => {
    const sorted = sortByFefo([
      { expiryDate: '2027-01-01' },
      { expiryDate: '2026-06-01' },
      { expiryDate: undefined },
    ])
    expect(sorted[0].expiryDate).toBe('2026-06-01')
    expect(sorted[2].expiryDate).toBeUndefined()
  })

  it('formatExpiryLabel for expired', () => {
    expect(formatExpiryLabel('2020-01-01')).toMatch(/Expired/)
  })
})

describe('locations', () => {
  it('shop and store labels', () => {
    expect(shopQty({ stock: 12 })).toBe(12)
    expect(storeQty({ storeStock: 48 })).toBe(48)
    expect(locationLabel(12, 48)).toBe('Shop 12 · Store 48')
    expect(locationLabel(1, 2, true)).toMatch(/Duka/)
  })
})

describe('invoice numbers', () => {
  it('increments invoiceSeq', async () => {
    await db.settings.put({
      id: 'main',
      businessName: 'Test',
      currency: 'TZS',
      taxRate: 0,
      taxInclusive: true,
      deviceId: 'test',
      offlineWindowHours: 72,
      invoiceSeq: 3,
    })
    const n = await nextInvoiceNumber()
    expect(n).toMatch(/^INV-\d{4}-0004$/)
    const s = await db.settings.get('main')
    expect(s?.invoiceSeq).toBe(4)
  })
})


describe('batches FEFO', () => {
  it('deducts earliest expiry first', async () => {
    const productId = uuidv4()
    await db.productBatches.clear()
    await db.products.put({
      id: productId,
      name: 'Meds',
      sku: 'M1',
      price: 1000,
      cost: 500,
      stock: 15,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await addBatch({ productId, productName: 'Meds', quantity: 10, expiryDate: '2026-12-01', location: 'shop' })
    await addBatch({ productId, productName: 'Meds', quantity: 5, expiryDate: '2026-06-01', location: 'shop' })
    const used = await deductFefo({ productId, quantity: 6, skipProductUpdate: true })
    expect(used[0].expiryDate).toBe('2026-06-01')
    expect(used[0].qty).toBe(5)
    expect(used[1].qty).toBe(1)
    const left = await listBatches(productId, 'shop')
    const june = left.find((b) => b.expiryDate === '2026-06-01')
    expect(june?.quantity ?? 0).toBe(0)
  })
})
