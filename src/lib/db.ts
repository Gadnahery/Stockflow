import Dexie, { type Table } from 'dexie'
import type {
  Product, Sale, OutboxEvent, User, AppSettings,
  Customer, Supplier, StockMovement, CashSession, Expense, PurchaseOrder, Branch, AuditLog, BranchStock, ProductBatch } from '../types'

export class StockFlowDB extends Dexie {
  products!: Table<Product, string>
  sales!: Table<Sale, string>
  stockMovements!: Table<StockMovement, string>
  customers!: Table<Customer, string>
  suppliers!: Table<Supplier, string>
  purchases!: Table<PurchaseOrder, string>
  cashSessions!: Table<CashSession, string>
  expenses!: Table<Expense, string>
  outbox!: Table<OutboxEvent, string>
  users!: Table<User, string>
  branches!: Table<Branch, string>
  settings!: Table<AppSettings, string>
  auditLogs!: Table<AuditLog, string>
  workspaceSnapshots!: Table<{ id: string; data: Record<string, unknown[]>; savedAt: string }, string>
  branchStock!: Table<BranchStock, string>
  productBatches!: Table<ProductBatch, string>

  constructor() {
    super('StockFlowDB')
    this.version(2).stores({
      products: 'id, sku, barcode, name, category, active',
      sales: 'id, createdAt, synced, receiptNumber, status, cashierId, shiftId',
      stockMovements: 'id, productId, type, createdAt, synced',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      purchases: 'id, supplierId, status, createdAt, synced',
      cashSessions: 'id, userId, status, openedAt',
      expenses: 'id, category, createdAt, synced',
      outbox: 'id, type, createdAt',
      users: 'id, pin, role, active',
      branches: 'id, name, active',
      settings: 'id',
    })
    this.version(3).stores({
      products: 'id, sku, barcode, name, category, active',
      sales: 'id, createdAt, synced, receiptNumber, status, cashierId, shiftId',
      stockMovements: 'id, productId, type, createdAt, synced',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      purchases: 'id, supplierId, status, createdAt, synced',
      cashSessions: 'id, userId, status, openedAt',
      expenses: 'id, category, createdAt, synced',
      outbox: 'id, type, createdAt',
      users: 'id, pin, role, active',
      branches: 'id, name, active',
      settings: 'id',
      auditLogs: 'id, action, entityType, createdAt',
    })
    this.version(4).stores({
      products: 'id, sku, barcode, name, category, active',
      sales: 'id, createdAt, synced, receiptNumber, status, cashierId, shiftId',
      stockMovements: 'id, productId, type, createdAt, synced, referenceId',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      purchases: 'id, supplierId, status, createdAt, synced',
      cashSessions: 'id, userId, status, openedAt',
      expenses: 'id, category, createdAt, synced',
      outbox: 'id, type, createdAt',
      users: 'id, pin, role, active',
      branches: 'id, name, active',
      settings: 'id',
      auditLogs: 'id, action, entityType, createdAt',
    })
    this.version(5).stores({
      products: 'id, sku, barcode, name, category, active',
      sales: 'id, createdAt, synced, receiptNumber, status, cashierId, shiftId',
      stockMovements: 'id, productId, type, createdAt, synced, referenceId',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      purchases: 'id, supplierId, status, createdAt, synced',
      cashSessions: 'id, userId, status, openedAt',
      expenses: 'id, category, createdAt, synced',
      outbox: 'id, type, createdAt',
      users: 'id, pin, role, active',
      branches: 'id, name, active',
      settings: 'id',
      auditLogs: 'id, action, entityType, createdAt',
      workspaceSnapshots: 'id, savedAt',
    })
    this.version(6).stores({
      products: 'id, sku, barcode, name, category, active',
      sales: 'id, createdAt, synced, receiptNumber, status, cashierId, shiftId',
      stockMovements: 'id, productId, type, createdAt, synced, referenceId',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      purchases: 'id, supplierId, status, createdAt, synced',
      cashSessions: 'id, userId, status, openedAt',
      expenses: 'id, category, createdAt, synced',
      outbox: 'id, type, createdAt',
      users: 'id, pin, role, active',
      branches: 'id, name, active',
      settings: 'id',
      auditLogs: 'id, action, entityType, createdAt',
      workspaceSnapshots: 'id, savedAt',
      branchStock: 'id, productId, branchId, updatedAt',
    })
    this.version(7).stores({
      products: 'id, sku, barcode, name, category, active',
      sales: 'id, createdAt, synced, receiptNumber, status, cashierId, shiftId',
      stockMovements: 'id, productId, type, createdAt, synced, referenceId',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      purchases: 'id, supplierId, status, createdAt, synced',
      cashSessions: 'id, userId, status, openedAt',
      expenses: 'id, category, createdAt, synced',
      outbox: 'id, type, createdAt',
      users: 'id, pin, role, active',
      branches: 'id, name, active',
      settings: 'id',
      auditLogs: 'id, action, entityType, createdAt',
      workspaceSnapshots: 'id, savedAt',
      branchStock: 'id, productId, branchId, updatedAt',
      productBatches: 'id, productId, expiryDate, location, branchId',
    })
  }
}

export const db = new StockFlowDB()

// Another window upgraded the database (new app version). Step aside instead of freezing, then reload.
db.on('versionchange', () => {
  db.close()
  try {
    const n = Number(sessionStorage.getItem('sf_db_reloads') || '0')
    if (typeof window !== 'undefined' && n < 2) {
      sessionStorage.setItem('sf_db_reloads', String(n + 1))
      setTimeout(() => window.location.reload(), 400)
      setTimeout(() => sessionStorage.removeItem('sf_db_reloads'), 60_000)
    }
  } catch { /* ignore */ }
})

// ───────── Automatic sync tracking ─────────
// Any change to these tables queues an outbox event, so no screen has to remember to.
let suppress = 0
/** Run local writes that must NOT be pushed back to the cloud (e.g. data just pulled from it). */
export async function withoutSync<T>(fn: () => Promise<T>): Promise<T> {
  suppress++
  try { return await fn() } finally { suppress-- }
}

function queue(type: OutboxEvent['type'], payload: unknown) {
  if (suppress > 0) return
  setTimeout(() => {
    db.outbox.add({
      id: crypto.randomUUID(), type, payload, createdAt: new Date().toISOString(), retries: 0,
    }).catch(() => undefined)
  }, 0)
}

function track(table: Table<any, string>, type: OutboxEvent['type']) {
  table.hook('creating', function (this: any, _pk: unknown, obj: unknown) {
    this.onsuccess = () => queue(type, obj)
  })
  table.hook('updating', function (this: any, _mods: unknown, _pk: unknown, obj: unknown) {
    this.onsuccess = (updated: unknown) => queue(type, updated ?? obj)
  })
}
track(db.products, 'product_upsert')
track(db.customers, 'customer_upsert')
track(db.suppliers, 'supplier_upsert')
track(db.cashSessions, 'shift')
track(db.stockMovements, 'stock_movement')
track(db.expenses, 'expense')
track(db.productBatches, 'product_batch')
track(db.purchases, 'purchase')

/** Append-only audit trail: who / what / when / where, with before → after values. */
export async function audit(
  action: string,
  entityType: string,
  entityId: string | undefined,
  detail: { before?: unknown; after?: unknown; reason?: string } = {}
) {
  let user: { id?: string; name?: string } = {}
  try { user = JSON.parse(sessionStorage.getItem('currentUser') || '{}') } catch { /* none */ }
  const settings = await db.settings.get('main').catch(() => undefined)
  const row: AuditLog = {
    id: crypto.randomUUID(), action, entityType, entityId, ...detail,
    userId: user.id, userName: user.name, deviceId: settings?.deviceId,
    createdAt: new Date().toISOString(),
  }
  await db.auditLogs.add(row)
  queue('audit', row)
}

export async function ensureSeedData() {
  // New businesses start EMPTY — never inject demo products/customers.
  // Only ensure device id + default settings shell exist.
  const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID()
  localStorage.setItem('deviceId', deviceId)

  const existing = await db.settings.get('main')
  if (!existing) {
    await db.settings.put({
      id: 'main',
      businessName: 'My Store',
      currency: 'TZS',
      taxRate: 18,
      taxInclusive: true,
      deviceId,
      offlineWindowHours: 72,
      receiptFooter: 'Thank you for shopping with us!',
      tinNumber: '',
      vrnNumber: '',
      fiscalMode: 'off',
      fiscalReceiptSeq: 0,
      industryType: 'retail',
      stockMode: 'shared',
      catalogMode: 'shared',
    })
  } else if (!existing.deviceId) {
    await db.settings.update('main', { deviceId })
  }
}

const WORKSPACE_KEY = 'sf_workspace_id'

const WORKSPACE_TABLES = [
  'products', 'sales', 'stockMovements', 'customers', 'suppliers',
  'purchases', 'cashSessions', 'expenses', 'outbox', 'users', 'branchStock', 'productBatches',
  'branches', 'settings', 'auditLogs',
] as const

/** Preserve each business' offline data before changing workspaces. */
async function saveWorkspaceSnapshot(workspaceId: string, includeProducts = true) {
  const data: Record<string, unknown[]> = {}
  for (const name of WORKSPACE_TABLES) {
    if (!includeProducts && name === 'products') continue
    data[name] = await (db as unknown as Record<string, Table<unknown, string>>)[name].toArray()
  }
  await db.workspaceSnapshots.put({ id: workspaceId, data, savedAt: new Date().toISOString() })
}

/** Restore only the target business' saved offline data. */
async function restoreWorkspaceSnapshot(workspaceId: string, legacyBusinessId?: string, includeProducts = true) {
  const snapshot = await db.workspaceSnapshots.get(workspaceId)
    ?? (legacyBusinessId ? await db.workspaceSnapshots.get(legacyBusinessId) : undefined)
  if (!snapshot) return false
  await withoutSync(async () => {
    for (const name of WORKSPACE_TABLES) {
      if (!includeProducts && name === 'products') continue
      const table = (db as unknown as Record<string, Table<unknown, string>>)[name]
      await table.clear()
      const rows = snapshot.data[name] ?? []
      if (rows.length) await table.bulkPut(rows)
    }
  })
  if (snapshot.id !== workspaceId) {
    await db.workspaceSnapshots.put({ ...snapshot, id: workspaceId, savedAt: new Date().toISOString() })
  }
  return true
}

/** Wipe only the active working tables after a snapshot has been saved. */
export async function clearLocalBusinessData(includeProducts = true) {
  await withoutSync(async () => {
    await Promise.all(WORKSPACE_TABLES.filter((name) => includeProducts || name !== 'products').map((name) =>
      (db as unknown as Record<string, Table<unknown, string>>)[name].clear()
    ))
  })
}

/**
 * Keep local records isolated by business without destroying them when the user
 * switches accounts. Snapshots live in IndexedDB, not localStorage, so product
 * images and larger offline datasets do not hit localStorage's small quota.
 */
export async function switchToBusinessWorkspace(businessId: string | null, _branchId: string | null = null, legacyBusinessId?: string) {
  // Product catalogue and offline records are shared across branches of one business.
  // Branch identity is stored separately for sales/reporting; including branchId here
  // creates a different IndexedDB workspace and makes the catalogue appear to vanish.
  const workspaceId = businessId ? `${businessId}:shared` : null
  const prev = localStorage.getItem(WORKSPACE_KEY)
  if (!businessId || !workspaceId) {
    // Sign-out is not data deletion. Leave the last workspace stored locally.
    return { switched: false }
  }
  if (prev === workspaceId) return { switched: false }

  const previousBusinessId = prev?.split(':')[0]
  const sameBusiness = previousBusinessId === businessId

  // One-time migration from older per-branch snapshots to a shared business workspace.
  // Preserve the currently loaded records and merge in records saved under sibling branches.
  if (prev && sameBusiness && prev !== workspaceId) {
    await saveWorkspaceSnapshot(workspaceId, true)
    const snapshots = await db.workspaceSnapshots.toArray()
    const siblingSnapshots = snapshots.filter((snapshot) =>
      snapshot.id.startsWith(`${businessId}:`) && snapshot.id !== workspaceId,
    )
    const merged = await db.workspaceSnapshots.get(workspaceId)
    if (merged) {
      for (const snapshot of siblingSnapshots) {
        for (const name of WORKSPACE_TABLES) {
          const currentRows = merged.data[name] ?? []
          const incomingRows = snapshot.data[name] ?? []
          const byId = new Map<string, unknown>()
          for (const row of [...currentRows, ...incomingRows]) {
            const id = (row as { id?: unknown }).id
            if (id != null) byId.set(String(id), row)
          }
          merged.data[name] = [...byId.values()]
        }
      }
      merged.savedAt = new Date().toISOString()
      await db.workspaceSnapshots.put(merged)
    }
    localStorage.setItem(WORKSPACE_KEY, workspaceId)
    return { switched: true, restored: true }
  }

  if (prev) await saveWorkspaceSnapshot(prev, !sameBusiness)
  // Product catalogue is shared within a business, but isolated between businesses.
  await clearLocalBusinessData(!sameBusiness)
  localStorage.setItem(WORKSPACE_KEY, workspaceId)

  const restored = await restoreWorkspaceSnapshot(workspaceId, legacyBusinessId, !sameBusiness)
  if (!restored) {
    const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID()
    localStorage.setItem('deviceId', deviceId)
    await withoutSync(async () => {
      await db.settings.put({
        id: 'main',
        businessName: 'My Store',
        currency: 'TZS',
        taxRate: 18,
        taxInclusive: true,
        deviceId,
        offlineWindowHours: 72,
        receiptFooter: 'Thank you for shopping with us!',
        tinNumber: '',
        vrnNumber: '',
        fiscalMode: 'off',
        fiscalReceiptSeq: 0,
        industryType: 'retail',
      stockMode: 'shared',
      catalogMode: 'shared',
      })
    })
  }
  return { switched: true, restored }
}
