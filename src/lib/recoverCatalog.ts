import { db } from './db'

const FLAG = 'sf_catalog_recovered_v2'

/** Mark the one-time catalog recovery as complete. Product records are shared by business
 * and the Product type has no branchId; do not mutate product rows during recovery. */
export async function recoverSharedCatalog(): Promise<number> {
  try {
    if (localStorage.getItem(FLAG) !== '1') localStorage.setItem(FLAG, '1')
  } catch {
    // Storage may be unavailable in private browsing; recovery is safe to retry.
  }
  // The catalog is now shared at query time, so no per-product branch rewrite is needed.
  await db.products.count().catch(() => 0)
  return 0
}