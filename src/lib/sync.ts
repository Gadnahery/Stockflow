/**
 * Offline → Supabase sync engine.
 * Local (Dexie) changes are queued in the outbox and pushed when online.
 * Every push is an idempotent upsert, so retries never create duplicates.
 */
import { db, withoutSync } from './db'
import { supabase, supabaseConfigured, getBusinessId, setBusinessId } from './supabase'
import type { AuditLog, Sale, Product, Customer, Supplier, Expense, StockMovement, PurchaseOrder, CashSession, OutboxEvent } from '../types'

const DEFAULT_BUSINESS_ID = 'a0000000-0000-4000-8000-000000000001'
const DEFAULT_BRANCH_ID = 'b0000000-0000-4000-8000-000000000001'
const IMAGE_BUCKET = 'product-images'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

async function ensureBusiness(): Promise<string> {
  const id = getBusinessId()
  if (id) return id
  if (!supabaseConfigured || !supabase) throw new Error('Supabase not configured')

  const { data: existing } = await supabase.from('businesses').select('id').limit(1)
  if (existing && existing.length > 0) {
    setBusinessId(existing[0].id)
    return existing[0].id
  }
  setBusinessId(DEFAULT_BUSINESS_ID)
  return DEFAULT_BUSINESS_ID
}

const getBranchId = () => localStorage.getItem('branchId') || DEFAULT_BRANCH_ID

/* ───────── push ───────── */

async function syncSale(sale: Sale, businessId: string) {
  const { error } = await supabase.from('sales').upsert({
    id: sale.id,
    business_id: businessId,
    branch_id: isUuid(sale.branchId) ? sale.branchId : getBranchId(),
    subtotal: sale.subtotal,
    discount_total: sale.discount,
    tax_total: sale.tax,
    total: sale.total,
    status: sale.status,
    receipt_number: sale.receiptNumber,
    cashier_name: sale.cashierName,
    customer_name: sale.customerName,
    customer_id: isUuid(sale.customerId) ? sale.customerId : null,
    device_id: sale.deviceId,
    payments: sale.payments,
    note: sale.note,
    created_at: sale.createdAt,
    client_created_at: sale.createdAt,
  }, { onConflict: 'id' })
  if (error) throw error

  // Replace items atomically-ish so a retry can never duplicate lines
  const del = await supabase.from('sale_items').delete().eq('sale_id', sale.id)
  if (del.error) throw del.error
  if (sale.items.length > 0) {
    const ins = await supabase.from('sale_items').insert(
      sale.items.map((item) => ({
        sale_id: sale.id,
        business_id: businessId,
        product_id: isUuid(item.productId) ? item.productId : null,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        discount_amount: item.discount,
        tax_amount: 0,
        line_total: item.lineTotal,
      }))
    )
    if (ins.error) throw ins.error
  }
}

/** Cheap fingerprint so a photo is only re-uploaded when it actually changed. */
function fingerprint(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i += 97) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `${s.length}:${h}`
}

async function uploadImage(product: Product, businessId: string): Promise<string | null> {
  const img = product.imageUrl
  if (!img) return null
  if (!img.startsWith('data:')) return img // already a hosted URL

  const fp = fingerprint(img)
  const cached = localStorage.getItem(`img:${product.id}`)
  if (cached) {
    const [savedFp, url] = JSON.parse(cached) as [string, string]
    if (savedFp === fp) return url
  }
  const blob = await (await fetch(img)).blob()
  const path = `${businessId}/${product.id}.jpg`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  const url = `${supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl}?v=${fp.replace(':', '-')}`
  localStorage.setItem(`img:${product.id}`, JSON.stringify([fp, url]))
  return url
}

async function syncProduct(product: Product, businessId: string) {
  if (!isUuid(product.id)) return
  let imageUrl: string | null = null
  try { imageUrl = await uploadImage(product, businessId) } catch (e) { console.warn('image upload', e) }

  const row: Record<string, unknown> = {
    id: product.id,
    business_id: businessId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode || null,
    unit_price: product.price,
    cost: product.cost,
    stock_quantity: product.stock,
    min_stock: product.minStock ?? 0,
    unit: product.unit || 'piece',
    category: product.category || null,
    is_active: product.active,
    tax_rate: 0,
    updated_at: product.updatedAt,
    created_at: product.createdAt,
  }
  if (imageUrl !== null || !product.imageUrl) row.image_url = imageUrl
  const { error } = await supabase.from('products').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

async function syncCustomer(customer: Customer, businessId: string) {
  if (!isUuid(customer.id)) return
  const { error } = await supabase.from('customers').upsert({
    id: customer.id,
    business_id: businessId,
    name: customer.name,
    phone: customer.phone || null,
    email: customer.email || null,
    address: customer.address || null,
    balance: customer.balance,
    credit_limit: customer.creditLimit,
    notes: customer.notes || null,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncSupplier(s: Supplier, businessId: string) {
  const { error } = await supabase.from('suppliers').upsert({
    id: s.id,
    business_id: businessId,
    name: s.name,
    phone: s.phone || null,
    email: s.email || null,
    address: s.address || null,
    balance: s.balance,
    notes: s.notes || null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncPurchase(po: PurchaseOrder, businessId: string) {
  const { error } = await supabase.from('purchases').upsert({
    id: po.id,
    business_id: businessId,
    supplier_id: isUuid(po.supplierId) ? po.supplierId : null,
    supplier_name: po.supplierName,
    items: po.items,
    status: po.status,
    total: po.total,
    note: po.note || null,
    created_at: po.createdAt,
    received_at: po.receivedAt || null,
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncShift(c: CashSession, businessId: string) {
  const { error } = await supabase.from('cash_sessions').upsert({
    id: c.id,
    business_id: businessId,
    user_id: isUuid(c.userId) ? c.userId : null,
    user_name: c.userName,
    opening_float: c.openingFloat,
    closing_cash: c.closingCash ?? null,
    expected_cash: c.expectedCash ?? null,
    variance: c.variance ?? null,
    status: c.status,
    opened_at: c.openedAt,
    closed_at: c.closedAt ?? null,
    notes: c.notes || null,
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncExpense(e: Expense, businessId: string) {
  const { error } = await supabase.from('expenses').upsert({
    id: e.id,
    business_id: businessId,
    branch_id: getBranchId(),
    category: e.category,
    amount: e.amount,
    expense_date: e.createdAt.slice(0, 10),
    note: e.note || null,
    // local staff ids are not Supabase auth users (FK) — keep the link out of the cloud row
    created_by: null,
    created_at: e.createdAt,
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncStockMovement(m: StockMovement, businessId: string) {
  if (!isUuid(m.productId)) return
  const { error } = await supabase.from('stock_movements').upsert({
    id: m.id,
    business_id: businessId,
    product_id: m.productId,
    product_name: m.productName,
    type: m.type,
    quantity: m.quantity,
    previous_stock: m.previousStock,
    new_stock: m.newStock,
    reason: m.reason || null,
    reference_id: isUuid(m.referenceId) ? m.referenceId : null,
    user_id: null,
    created_at: m.createdAt,
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncAudit(a: AuditLog, businessId: string) {
  const { error } = await supabase.from('audit_logs').upsert({
    id: a.id, business_id: businessId, user_id: a.userId ?? null, user_name: a.userName ?? null,
    action: a.action, entity_type: a.entityType ?? null, entity_id: a.entityId ?? null,
    before_value: a.before ?? null, after_value: a.after ?? null, reason: a.reason ?? null,
    device_id: a.deviceId ?? null, created_at: a.createdAt,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}

async function processEvent(event: OutboxEvent, businessId: string) {
  const payload = event.payload as never
  switch (event.type) {
    case 'sale':
      await syncSale(payload, businessId)
      await db.sales.update((payload as Sale).id, { synced: true })
      break
    case 'product_upsert': await syncProduct(payload, businessId); break
    case 'customer_upsert': await syncCustomer(payload, businessId); break
    case 'supplier_upsert': await syncSupplier(payload, businessId); break
    case 'purchase': await syncPurchase(payload, businessId); break
    case 'shift': await syncShift(payload, businessId); break
    case 'expense': await syncExpense(payload, businessId); break
    case 'stock_movement': await syncStockMovement(payload, businessId); break
    case 'audit': await syncAudit(payload, businessId); break
    default:
      console.warn('dropping unknown outbox event', event.type)
  }
}

/** One-time: queue everything that existed on this device before auto-tracking was added. */
async function queueExistingOnce() {
  if (localStorage.getItem('initialPushV1')) return
  const now = new Date().toISOString()
  const mk = (type: OutboxEvent['type'], payload: unknown): OutboxEvent => ({ id: crypto.randomUUID(), type, payload, createdAt: now, retries: 0 })
  const [products, customers, suppliers, sessions, expenses, sales] = await Promise.all([
    db.products.toArray(), db.customers.toArray(), db.suppliers.toArray(),
    db.cashSessions.toArray(), db.expenses.toArray(), db.sales.filter((s) => !s.synced).toArray(),
  ])
  await db.outbox.bulkAdd([
    ...products.map((p) => mk('product_upsert', p)),
    ...customers.map((c) => mk('customer_upsert', c)),
    ...suppliers.map((s) => mk('supplier_upsert', s)),
    ...sessions.map((c) => mk('shift', c)),
    ...expenses.map((e) => mk('expense', e)),
    ...sales.map((s) => mk('sale', s)),
  ])
  localStorage.setItem('initialPushV1', '1')
}

export async function processOutbox(): Promise<{ synced: number; failed: number }> {
  if (!supabaseConfigured || !navigator.onLine) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  try {
    const businessId = await ensureBusiness()
    await queueExistingOnce()
    const events = await db.outbox.orderBy('createdAt').toArray()

    for (const event of events) {
      try {
        await processEvent(event, businessId)
        await db.outbox.delete(event.id)
        synced++
      } catch (err) {
        failed++
        const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
        await db.outbox.update(event.id, { retries: event.retries + 1, lastError: message })
        console.warn('sync failed', event.type, message)
      }
    }
  } catch (err) {
    console.warn('processOutbox', err)
  }
  return { synced, failed }
}

/* ───────── pull ───────── */

/**
 * Bring in products and customers created on other devices.
 * Only adds what is missing locally — existing local rows (and their live stock) are never overwritten.
 */
export async function pullMissing(): Promise<number> {
  if (!supabaseConfigured || !navigator.onLine) return 0
  const businessId = getBusinessId()
  if (!businessId) return 0

  const [{ data: prodRows }, { data: custRows }] = await Promise.all([
    supabase.from('products').select('*').eq('business_id', businessId),
    supabase.from('customers').select('*').eq('business_id', businessId),
  ])

  const localProducts = new Set((await db.products.toCollection().primaryKeys()) as string[])
  const localCustomers = new Set((await db.customers.toCollection().primaryKeys()) as string[])
  const now = new Date().toISOString()
  let added = 0

  await withoutSync(async () => {
    for (const row of prodRows ?? []) {
      if (localProducts.has(row.id)) continue
      await db.products.put({
        id: row.id,
        name: row.name,
        sku: row.sku || String(row.id).slice(0, 8),
        barcode: row.barcode || undefined,
        price: Number(row.unit_price) || 0,
        cost: Number(row.cost) || 0,
        stock: Number(row.stock_quantity) || 0,
        minStock: Number(row.min_stock) || undefined,
        category: row.category || undefined,
        unit: row.unit || 'piece',
        imageUrl: row.image_url || undefined,
        active: row.is_active !== false,
        createdAt: row.created_at || now,
        updatedAt: row.updated_at || now,
      })
      added++
    }
    for (const row of custRows ?? []) {
      if (localCustomers.has(row.id)) continue
      await db.customers.put({
        id: row.id,
        name: row.name,
        phone: row.phone || undefined,
        email: row.email || undefined,
        address: row.address || undefined,
        balance: Number(row.balance) || 0,
        creditLimit: Number(row.credit_limit) || 0,
        notes: row.notes || undefined,
        createdAt: row.created_at || now,
        updatedAt: row.updated_at || now,
      })
      added++
    }
  })
  return added
}

/** Push everything pending, then pull anything new from other devices. */
export async function syncNow() {
  const result = await processOutbox()
  const pending = await db.outbox.count()
  const pulled = result.failed === 0 && pending === 0 ? await pullMissing().catch(() => 0) : 0
  return { ...result, pulled, pending }
}

export function startSyncLoop(intervalMs = 30000) {
  let ticks = 0
  const tick = async () => {
    if (!navigator.onLine) return
    const result = await processOutbox()
    if (result.synced > 0) console.info(`Synced ${result.synced} events`)
    // pull on first run and then every ~5 minutes
    if (ticks++ % 10 === 0 && result.failed === 0 && (await db.outbox.count()) === 0) await pullMissing().catch(() => 0)
  }
  tick()
  return window.setInterval(tick, intervalMs)
}
