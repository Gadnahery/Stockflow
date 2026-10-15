/**
 * Branch catalogue modes (owner choice).
 *
 * shared   — one product list for the whole business (default)
 * isolated — each branch owns its own products & stock; other branches look empty
 *            until products are created there. Same owner, like a second shop.
 *
 * Merge: switching isolated → shared clears product.branchId so everything is one list again.
 */
import { db } from './db'
import { getBranchId } from './supabase'
import type { Product } from '../types'

export type CatalogMode = 'shared' | 'isolated'

export async function getCatalogMode(): Promise<CatalogMode> {
  try {
    const s = await db.settings.get('main')
    return s?.catalogMode === 'isolated' ? 'isolated' : 'shared'
  } catch {
    return 'shared'
  }
}

/** Products visible for the active branch under current mode. Never deletes rows. */
export function productVisibleOnBranch(
  product: Product,
  mode: CatalogMode,
  branchId: string | null,
): boolean {
  if (product.active === false) return false
  if (mode !== 'isolated') return true
  if (!branchId) return !product.branchId // no branch selected: only shared leftovers
  return product.branchId === branchId
}

export async function filterProductsForActiveBranch(products: Product[]): Promise<Product[]> {
  const mode = await getCatalogMode()
  const branchId = getBranchId()
  return products.filter((p) => productVisibleOnBranch(p, mode, branchId))
}

/**
 * Set catalogue mode.
 * - shared → isolated: attach existing products to the current branch so that branch keeps them; others start empty
 * - isolated → shared (merge): clear branchId on all products so every branch sees the full list
 */
export async function setCatalogMode(mode: CatalogMode, opts?: { assignToBranchId?: string | null }): Promise<void> {
  const current = await getCatalogMode()
  const now = new Date().toISOString()
  const active = opts?.assignToBranchId ?? getBranchId()

  if (mode === 'isolated' && current !== 'isolated') {
    // Keep current branch full: tag unscoped products to active branch
    if (active) {
      const all = await db.products.toArray()
      for (const p of all) {
        if (!p.branchId) {
          await db.products.update(p.id, { branchId: active, updatedAt: now })
        }
      }
    }
    await db.settings.update('main', { catalogMode: 'isolated' })
    return
  }

  if (mode === 'shared' && current === 'isolated') {
    // Merge: one catalogue again
    const all = await db.products.toArray()
    for (const p of all) {
      if (p.branchId) {
        await db.products.update(p.id, { branchId: undefined, updatedAt: now })
      }
    }
    await db.settings.update('main', { catalogMode: 'shared' })
    return
  }

  await db.settings.update('main', { catalogMode: mode })
}
