import Dexie, { type Table } from 'dexie'
import type {
  Product, Sale, OutboxEvent, User, AppSettings,
  Customer, Supplier, StockMovement, CashSession, Expense, PurchaseOrder, Branch
} from '../types'

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

export async function ensureSeedData() {
  const count = await db.products.count()
  if (count > 0) return

  const now = new Date().toISOString()
  const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID()
  localStorage.setItem('deviceId', deviceId)

  // Sample products
  const sampleProducts: Product[] = [
    { id: 'c0000000-0000-4000-8000-000000000001', name: 'Coca Cola 500ml', sku: 'BEV-001', barcode: '6001234567890', price: 1500, cost: 900, stock: 120, minStock: 20, category: 'Beverages', unit: 'piece', active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-000000000002', name: 'Bread Loaf', sku: 'BAK-001', barcode: '6001234567891', price: 2500, cost: 1600, stock: 45, minStock: 10, category: 'Bakery', unit: 'piece', active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-000000000003', name: 'Milk 1L', sku: 'DAI-001', barcode: '6001234567892', price: 3200, cost: 2400, stock: 60, minStock: 15, category: 'Dairy', unit: 'piece', active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-000000000004', name: 'Rice 5kg', sku: 'GRO-001', barcode: '6001234567893', price: 18500, cost: 14000, stock: 30, minStock: 5, category: 'Grocery', unit: 'bag', active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-000000000005', name: 'Soap Bar', sku: 'HOU-001', barcode: '6001234567894', price: 1200, cost: 700, stock: 80, minStock: 20, category: 'Household', unit: 'piece', active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-000000000006', name: 'Cooking Oil 2L', sku: 'GRO-002', barcode: '6001234567895', price: 9800, cost: 7200, stock: 25, minStock: 8, category: 'Grocery', unit: 'bottle', active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-000000000007', name: 'Sugar 1kg', sku: 'GRO-003', barcode: '6001234567896', price: 2800, cost: 2100, stock: 50, minStock: 10, category: 'Grocery', unit: 'packet', active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-000000000008', name: 'Water 1.5L', sku: 'BEV-002', barcode: '6001234567897', price: 1000, cost: 600, stock: 200, minStock: 40, category: 'Beverages', unit: 'bottle', active: true, createdAt: now, updatedAt: now },
  ]
  await db.products.bulkAdd(sampleProducts)

  // Settings
  await db.settings.put({
    id: 'main',
    businessName: 'Demo Store',
    businessPhone: '+255 700 000 000',
    businessAddress: 'Dar es Salaam, Tanzania',
    currency: 'TZS',
    taxRate: 18,
    taxInclusive: true,
    deviceId,
    offlineWindowHours: 72,
    receiptFooter: 'Thank you for shopping with us!',
  })

  // Default users
  await db.users.bulkAdd([
    {
      id: crypto.randomUUID(),
      name: 'Owner',
      pin: '0000',
      role: 'owner',
      permissions: [
        'CREATE_SALE', 'VOID_SALE', 'REFUND_SALE', 'CHANGE_PRICE', 'APPLY_DISCOUNT',
        'ADJUST_STOCK', 'VIEW_PROFIT', 'EXPORT_DATA', 'MANAGE_USERS', 'MANAGE_PRODUCTS',
        'MANAGE_CUSTOMERS', 'MANAGE_SUPPLIERS', 'VIEW_REPORTS', 'MANAGE_SHIFTS', 'MANAGE_SETTINGS'
      ],
      active: true,
    },
    {
      id: crypto.randomUUID(),
      name: 'Cashier',
      pin: '1234',
      role: 'cashier',
      permissions: ['CREATE_SALE', 'APPLY_DISCOUNT'],
      active: true,
    },
  ])

  // Sample customer
  await db.customers.add({
    id: 'c1000000-0000-4000-8000-000000000001',
    name: 'Walk-in Customer',
    creditLimit: 0,
    balance: 0,
    createdAt: now,
    updatedAt: now,
  })

  // Branch
  await db.branches.add({
    id: crypto.randomUUID(),
    name: 'Main Branch',
    active: true,
  })
}
