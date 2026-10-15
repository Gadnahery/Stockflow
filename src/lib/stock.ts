/**
 * Stock modes for multi-branch shops.
 *
 * shared     — one quantity on the product row (default). All branches share stock.
 * per_branch — same product catalogue, separate quantity per branch in branchStock.
 *
 * Products are NEVER hidden by branch. Only quantities differ in per_branch mode.
 */
import { db } from './db'
import { getBranchId } from './supabase'
import type { Product } from '../types'

export type StockMode = 'shared' | 'per_branch'

export async function getStockMode(): Promise<StockMode> {
  try {
    const s = await db.settings.get('main')
    return s?.stockMode === 'per_branch' ? 'per_branch' : 'shared'
  } catch {
    return 'shared'
  }
}

export function branchStockId(productId: string, branchId: string) {
  return `${productId}:${branchId}`
}

/** Effective stock for POS / product list for a product at a branch */
export async function getEffectiveStock(
  product: Product,
  branchId?: string | null,
  mode?: StockMode,
): Promise<number> {
  const m = mode ?? (await getStockMode())
  if (m !== 'per_branch') return product.stock ?? 0
  const bid = branchId || getBranchId()
  if (!bid) return product.stock ?? 0
  const row = await db.branchStock.get(branchStockId(product.id, bid))
  return row?.stock ?? 0
}

/** Map of productId → stock for active branch (or shared product.stock) */
export async function stockMapForProducts(
  products: Product[],
  branchId?: string | null,
): Promise<Map<string, number>> {
  const mode = await getStockMode()
  const map = new Map<string, number>()
  if (mode !== 'per_branch') {
    for (const p of products) map.set(p.id, p.stock ?? 0)
    return map
  }
  const bid = branchId || getBranchId()
  if (!bid) {
    for (const p of products) map.set(p.id, p.stock ?? 0)
    return map
  }
  const rows = await db.branchStock.where('branchId').equals(bid).toArray()
  const byProduct = new Map(rows.map((r) => [r.productId, r.stock]))
  for (const p of products) {
    map.set(p.id, byProduct.has(p.id) ? (byProduct.get(p.id) as number) : 0)
  }
  return map
}

/** Total stock across all branches (merge view) */
export async function mergedStockForProduct(productId: string, fallbackShared: number): Promise<number> {
  const mode = await getStockMode()
  if (mode !== 'per_branch') return fallbackShared
  const rows = await db.branchStock.where('productId').equals(productId).toArray()
  if (!rows.length) return fallbackShared
  return rows.reduce((s, r) => s + (r.stock || 0), 0)
}

/**
 * Apply stock change for a sale/adjustment.
 * Returns previous and new quantities for the movement log.
 */
export async function applyStockChange(opts: {
  productId: string
  productName: string
  delta: number // negative = out
  branchId?: string | null
  now?: string
}): Promise<{ previous: number; next: number; mode: StockMode }> {
  const mode = await getStockMode()
  const now = opts.now || new Date().toISOString()
  const product = await db.products.get(opts.productId)
  if (!product) return { previous: 0, next: 0, mode }

  if (mode === 'per_branch') {
    const bid = opts.branchId || getBranchId()
    if (!bid) {
      // No branch selected — fall back to shared product.stock
      const previous = product.stock ?? 0
      const next = Math.max(0, previous + opts.delta)
      await db.products.update(opts.productId, { stock: next, updatedAt: now })
      return { previous, next, mode: 'shared' }
    }
    const id = branchStockId(opts.productId, bid)
    const existing = await db.branchStock.get(id)
    const previous = existing?.stock ?? 0
    const next = Math.max(0, previous + opts.delta)
    await db.branchStock.put({
      id,
      productId: opts.productId,
      branchId: bid,
      stock: next,
      minStock: existing?.minStock,
      updatedAt: now,
      synced: false,
    })
    return { previous, next, mode }
  }

  const previous = product.stock ?? 0
  const next = Math.max(0, previous + opts.delta)
  await db.products.update(opts.productId, { stock: next, updatedAt: now })
  return { previous, next, mode }
}

/**
 * Switch stock mode. Seeds or merges so the owner never "loses" quantities.
 * - shared → per_branch: copy each product.stock into every known branch
 * - per_branch → shared: sum branch quantities into product.stock
 */
export async function setStockMode(
  mode: StockMode,
  branchIds: string[],
): Promise<void> {
  const current = await getStockMode()
  const now = new Date().toISOString()
  const products = await db.products.toArray()

  if (mode === 'per_branch' && current !== 'per_branch') {
    const targets = branchIds.length ? branchIds : [getBranchId()].filter(Boolean) as string[]
    if (!targets.length) {
      await db.settings.update('main', { stockMode: 'per_branch' })
      return
    }
    for (const p of products) {
      for (const bid of targets) {
        const id = branchStockId(p.id, bid)
        const existing = await db.branchStock.get(id)
        if (!existing) {
          await db.branchStock.put({
            id,
            productId: p.id,
            branchId: bid,
            stock: p.stock ?? 0,
            minStock: p.minStock,
            updatedAt: now,
            synced: false,
          })
        }
      }
    }
    await db.settings.update('main', { stockMode: 'per_branch' })
    return
  }

  if (mode === 'shared' && current === 'per_branch') {
    // Merge: sum all branch rows into product.stock
    for (const p of products) {
      const rows = await db.branchStock.where('productId').equals(p.id).toArray()
      const total = rows.length ? rows.reduce((s, r) => s + (r.stock || 0), 0) : p.stock ?? 0
      await db.products.update(p.id, { stock: total, updatedAt: now })
    }
    await db.settings.update('main', { stockMode: 'shared' })
    return
  }

  await db.settings.update('main', { stockMode: mode })
}
