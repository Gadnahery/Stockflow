import { db } from './db'

const FLAG = 'sf_catalog_recovered_v1'

/** One-time: un-hide products that were tagged with a branch and no longer appear. */
export async function recoverSharedCatalog(): Promise<number> {
  try {
    if (localStorage.getItem(FLAG) === '1') return 0
  } catch {
    return 0
  }
  let n = 0
  try {
    const all = await db.products.toArray()
    for (const p of all) {
      if (p.branchId) {
        await db.products.update(p.id, { branchId: undefined, updatedAt: new Date().toISOString() })
        n++
      }
      // Reactivate soft-deleted only if it looks like a mistake (optional — skip)
    }
    localStorage.setItem(FLAG, '1')
  } catch {
    /* ignore */
  }
  return n
}
