import Dexie, { type Table } from 'dexie'
import type {
  Product, Sale, OutboxEvent, User, AppSettings,
  Customer, Supplier, StockMovement, CashSession, Expense, PurchaseOrder, Branch, AuditLog } from '../types'

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
  }
}

export const db = new StockFlowDB()

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
    })
  } else if (!existing.deviceId) {
    await db.settings.update('main', { deviceId })
  }
}

const WORKSPACE_KEY = 'sf_workspace_id'

/** Wipe local catalogue/sales so one shop never sees another shop's data. */
export async function clearLocalBusinessData() {
  await withoutSync(async () => {
    await Promise.all([
      db.products.clear(),
      db.sales.clear(),
      db.stockMovements.clear(),
      db.customers.clear(),
      db.suppliers.clear(),
      db.purchases.clear(),
      db.cashSessions.clear(),
      db.expenses.clear(),
      db.outbox.clear(),
      db.auditLogs.clear(),
      db.branches.clear(),
    ])
  })
}

/**
 * Call whenever the signed-in business changes.
 * Clears leftover IndexedDB from a previous account/demo.
 */
export async function switchToBusinessWorkspace(businessId: string | null) {
  const prev = localStorage.getItem(WORKSPACE_KEY)
  if (!businessId) {
    if (prev) {
      await clearLocalBusinessData()
      localStorage.removeItem(WORKSPACE_KEY)
    }
    return { switched: Boolean(prev) }
  }
  if (prev === businessId) return { switched: false }
  await clearLocalBusinessData()
  localStorage.setItem(WORKSPACE_KEY, businessId)
  // Reset settings name shell (cloud pull / onboarding will fill real name)
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
    })
  })
  return { switched: true }
}
