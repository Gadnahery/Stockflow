/**
 * Product batches + FEFO (first-expired-first-out).
 * Stock on product.stock stays the shop total; batches explain which lots make it up when trackExpiry is on.
 */
import { db } from './db'
import { v4 as uuidv4 } from 'uuid'
import type { ProductBatch } from '../types'
import { sortByFefo, isExpired } from './expiry'
import { getBranchId } from './supabase'

export async function listBatches(productId: string, location?: 'shop' | 'store'): Promise<ProductBatch[]> {
  let rows = await db.productBatches.where('productId').equals(productId).toArray()
  if (location) rows = rows.filter((b) => b.location === location)
  return sortByFefo(rows.filter((b) => b.quantity > 0))
}

export async function addBatch(input: {
  productId: string
  productName: string
  quantity: number
  batchNo?: string
  expiryDate?: string
  location: 'shop' | 'store'
  branchId?: string | null
}): Promise<ProductBatch> {
  const now = new Date().toISOString()
  const batch: ProductBatch = {
    id: uuidv4(),
    productId: input.productId,
    productName: input.productName,
    batchNo: input.batchNo?.trim() || undefined,
    expiryDate: input.expiryDate?.slice(0, 10) || undefined,
    quantity: Math.max(0, input.quantity),
    location: input.location,
    branchId: input.branchId || getBranchId() || undefined,
    createdAt: now,
    updatedAt: now,
    synced: false,
  }
  await db.productBatches.put(batch)
  return batch
}

/**
 * Deduct qty from shop batches using FEFO. Returns allocations for audit.
 * Also updates product.stock (caller may already update stock; pass skipProductUpdate).
 */
export async function deductFefo(opts: {
  productId: string
  quantity: number
  skipProductUpdate?: boolean
}): Promise<{ batchId: string; qty: number; expiryDate?: string }[]> {
  const need = opts.quantity
  if (need <= 0) return []
  const batches = await listBatches(opts.productId, 'shop')
  let left = need
  const used: { batchId: string; qty: number; expiryDate?: string }[] = []
  const now = new Date().toISOString()

  for (const b of batches) {
    if (left <= 0) break
    if (isExpired({ expiryDate: b.expiryDate })) continue // skip expired lots
    const take = Math.min(b.quantity, left)
    if (take <= 0) continue
    await db.productBatches.update(b.id, { quantity: b.quantity - take, updatedAt: now })
    used.push({ batchId: b.id, qty: take, expiryDate: b.expiryDate })
    left -= take
  }

  // If still short, take from expired batches last (should be rare if POS blocks)
  if (left > 0) {
    for (const b of batches) {
      if (left <= 0) break
      if (!isExpired({ expiryDate: b.expiryDate })) continue
      const take = Math.min(b.quantity, left)
      if (take <= 0) continue
      await db.productBatches.update(b.id, { quantity: b.quantity - take, updatedAt: now })
      used.push({ batchId: b.id, qty: take, expiryDate: b.expiryDate })
      left -= take
    }
  }

  if (!opts.skipProductUpdate) {
    const product = await db.products.get(opts.productId)
    if (product) {
      await db.products.update(opts.productId, {
        stock: Math.max(0, (product.stock || 0) - need),
        updatedAt: now,
      })
    }
  }
  return used
}

/** Restock into a batch (void/refund) — prefers matching expiry or creates return batch */
export async function restockBatch(opts: {
  productId: string
  productName: string
  quantity: number
  expiryDate?: string
  location?: 'shop' | 'store'
}): Promise<void> {
  const location = opts.location || 'shop'
  const batches = await listBatches(opts.productId, location)
  const now = new Date().toISOString()
  const match = opts.expiryDate
    ? batches.find((b) => b.expiryDate === opts.expiryDate)
    : batches[0]
  if (match) {
    await db.productBatches.update(match.id, {
      quantity: match.quantity + opts.quantity,
      updatedAt: now,
    })
  } else {
    await addBatch({
      productId: opts.productId,
      productName: opts.productName,
      quantity: opts.quantity,
      expiryDate: opts.expiryDate,
      location,
    })
  }
}

export async function expiringProducts(warnDays = 30): Promise<
  { productId: string; productName: string; expiryDate: string; quantity: number; days: number }[]
> {
  const all = await db.productBatches.toArray()
  const products = await db.products.toArray()
  const byId = new Map(products.map((p) => [p.id, p]))
  const out: { productId: string; productName: string; expiryDate: string; quantity: number; days: number }[] = []
  const now = new Date()
  for (const b of all) {
    if (!b.expiryDate || b.quantity <= 0) continue
    const exp = new Date(b.expiryDate.slice(0, 10) + 'T12:00:00')
    const days = Math.floor((exp.getTime() - now.getTime()) / 86_400_000)
    if (days > warnDays) continue
    const p = byId.get(b.productId)
    out.push({
      productId: b.productId,
      productName: b.productName || p?.name || 'Product',
      expiryDate: b.expiryDate,
      quantity: b.quantity,
      days,
    })
  }
  // Also products with only product.expiryDate
  for (const p of products) {
    if (!p.expiryDate || (p.stock || 0) <= 0) continue
    if (out.some((x) => x.productId === p.id)) continue
    const exp = new Date(p.expiryDate.slice(0, 10) + 'T12:00:00')
    const days = Math.floor((exp.getTime() - now.getTime()) / 86_400_000)
    if (days > warnDays) continue
    out.push({
      productId: p.id,
      productName: p.name,
      expiryDate: p.expiryDate,
      quantity: p.stock,
      days,
    })
  }
  return out.sort((a, b) => a.days - b.days)
}

export async function writeOffExpired(opts: {
  productId: string
  quantity: number
  userId?: string
}): Promise<void> {
  const product = await db.products.get(opts.productId)
  if (!product) throw new Error('Product not found')
  const qty = Math.min(opts.quantity, product.stock || 0)
  if (qty <= 0) throw new Error('Nothing to write off')
  const now = new Date().toISOString()
  await deductFefo({ productId: opts.productId, quantity: qty, skipProductUpdate: true })
  await db.products.update(opts.productId, {
    stock: Math.max(0, (product.stock || 0) - qty),
    updatedAt: now,
  })
  await db.stockMovements.add({
    id: uuidv4(),
    productId: opts.productId,
    productName: product.name,
    type: 'damage',
    quantity: -qty,
    previousStock: product.stock,
    newStock: Math.max(0, product.stock - qty),
    reason: 'Expired write-off',
    userId: opts.userId,
    createdAt: now,
    synced: false,
  })
}
