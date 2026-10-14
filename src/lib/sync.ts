/**
 * Offline → Supabase sync engine.
 * Local (Dexie) changes are queued in the outbox and pushed when online.
 * Every push is an idempotent upsert, so retries never create duplicates.
 */
import { db, withoutSync } from './db'
import { supabase, supabaseConfigured, getBusinessId, setBusinessId } from './supabase'
import type { AuditLog, Payment, Sale, Product, Customer, Supplier, Expense, StockMovement, PurchaseOrder, CashSession, OutboxEvent } from '../types'

const IMAGE_BUCKET = 'product-images'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)
const MAX_OUTBOX_RETRIES = 12
const lastPullKey = () => `sf_last_pull:${getBusinessId() || 'none'}:${getBranchId() || 'none'}`
const LAST_SYNC_KEY = 'sf_last_sync'

async function ensureBusiness(): Promise<string> {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Cloud sync is not configured')
  }
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) {
    throw new Error('Not signed in — open Account and sign in again')
  }

  // Always resolve from membership (ignore stale localStorage demo ids)
  const { data: members, error } = await supabase
    .from('business_members')
    .select('business_id, branch_ids, role, permissions, status')
    .eq('user_id', uid)
    .eq('status', 'active')
    .limit(1)
  if (error) throw error
  if (!members?.[0]?.business_id) {
    clearWrongBusiness()
    throw new Error('No business on this account — finish onboarding first')
  }
  const biz = members[0].business_id as string
  setBusinessId(biz)
  const branches = members[0].branch_ids as string[] | null
  const selectedBranch = getBranchId()
  const ownerCanUseAnyBranch = ['owner', 'business_owner', 'platform_admin'].includes(String(members[0].role))
  if (branches?.[0] && (!selectedBranch || (!branches.includes(selectedBranch) && !ownerCanUseAnyBranch))) {
    localStorage.setItem('branchId', branches[0])
  }
  return biz
}

function clearWrongBusiness() {
  try {
    localStorage.removeItem('businessId')
    localStorage.removeItem('branchId')
  } catch { /* ignore */ }
}

const getBranchId = (): string | null => {
  const id = localStorage.getItem('branchId')
  if (id && isUuid(id)) return id
  return null
}

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
    branch_id: getBranchId(),
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
      if ((event.retries || 0) >= MAX_OUTBOX_RETRIES) {
        // Dead-letter — keep for diagnostics, skip forever until user discards
        failed++
        continue
      }
      try {
        await processEvent(event, businessId)
        await db.outbox.delete(event.id)
        synced++
      } catch (err) {
        failed++
        const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err)
        await db.outbox.update(event.id, { retries: (event.retries || 0) + 1, lastError: message })
        console.warn('sync failed', event.type, message)
      }
    }
    if (synced > 0) {
      try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()) } catch { /* ignore */ }
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

  let since = '1970-01-01T00:00:00.000Z'
  try {
    const s = localStorage.getItem(lastPullKey())
    if (s) since = s
  } catch { /* ignore */ }

  const nowIso = new Date().toISOString()
  let added = 0

  const [{ data: prodRows }, { data: custRows }, { data: supRows }, { data: saleRows }, { data: expRows }, { data: movRows }] =
    await Promise.all([
      // Products are a business-wide shared catalogue. Always fetch the full catalogue:
      // a branch/workspace switch can clear local IndexedDB while the incremental cursor
      // still points to a recent timestamp, which otherwise hides older products forever.
      supabase.from('products').select('*').eq('business_id', businessId),
      supabase.from('customers').select('*').eq('business_id', businessId).gte('updated_at', since),
      supabase.from('suppliers').select('*').eq('business_id', businessId).gte('updated_at', since),
      supabase.from('sales').select('*').eq('business_id', businessId).eq('branch_id', getBranchId()).gte('created_at', since).limit(500),
      supabase.from('expenses').select('*').eq('business_id', businessId).eq('branch_id', getBranchId()).gte('created_at', since).limit(300),
      supabase.from('stock_movements').select('*').eq('business_id', businessId).gte('created_at', since).limit(500),
    ])

  const localProducts = new Set((await db.products.toCollection().primaryKeys()) as string[])
  const localCustomers = new Set((await db.customers.toCollection().primaryKeys()) as string[])
  const localSuppliers = new Set((await db.suppliers.toCollection().primaryKeys()) as string[])
  const localSales = new Set((await db.sales.toCollection().primaryKeys()) as string[])
  const localExpenses = new Set((await db.expenses.toCollection().primaryKeys()) as string[])
  const localMovements = new Set((await db.stockMovements.toCollection().primaryKeys()) as string[])
  const now = nowIso

  await withoutSync(async () => {
    for (const row of prodRows ?? []) {
      if (localProducts.has(row.id)) {
        // Cloud is newer — update stock/price if remote updated_at is later
        const local = await db.products.get(row.id)
        if (local && row.updated_at && local.updatedAt && row.updated_at > local.updatedAt) {
          await db.products.update(row.id, {
            name: row.name,
            sku: row.sku || local.sku,
            barcode: row.barcode || undefined,
            price: Number(row.unit_price) || 0,
            cost: Number(row.cost) || 0,
            stock: Number(row.stock_quantity) ?? local.stock,
            minStock: Number(row.min_stock) || undefined,
            category: row.category || undefined,
            unit: row.unit || local.unit,
            imageUrl: row.image_url || local.imageUrl,
            active: row.is_active !== false,
            updatedAt: row.updated_at || now,
          })
          added++
        }
        continue
      }
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

    for (const row of supRows ?? []) {
      if (localSuppliers.has(row.id)) continue
      await db.suppliers.put({
        id: row.id,
        name: row.name,
        phone: row.phone || undefined,
        email: row.email || undefined,
        address: row.address || undefined,
        balance: Number(row.balance) || 0,
        notes: row.notes || undefined,
        createdAt: row.created_at || now,
        updatedAt: row.updated_at || now,
      })
      added++
    }

    for (const row of saleRows ?? []) {
      if (localSales.has(row.id)) continue
      const payments = Array.isArray(row.payments) ? row.payments : []
      // Fetch line items for this sale
      const { data: items } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', row.id)
      await db.sales.put({
        id: row.id,
        deviceId: row.device_id || 'remote',
        items: (items || []).map((it: Record<string, unknown>) => ({
          productId: String(it.product_id || ''),
          name: String(it.product_name || ''),
          sku: '',
          price: Number(it.unit_price) || 0,
          quantity: Number(it.quantity) || 0,
          discount: Number(it.discount_amount) || 0,
          lineTotal: Number(it.line_total) || 0,
        })),
        subtotal: Number(row.subtotal) || 0,
        discount: Number(row.discount_total) || 0,
        tax: Number(row.tax_total) || 0,
        total: Number(row.total) || 0,
        payments: payments as Payment[],
        customerId: row.customer_id || undefined,
        customerName: row.customer_name || undefined,
        cashierId: row.user_id || undefined,
        cashierName: row.cashier_name || undefined,
        status: (row.status as 'completed' | 'voided' | 'held') || 'completed',
        receiptNumber: row.receipt_number || row.id.slice(0, 8),
        note: row.note || undefined,
        createdAt: row.created_at || now,
        synced: true,
      })
      added++
    }

    for (const row of expRows ?? []) {
      if (localExpenses.has(row.id)) continue
      await db.expenses.put({
        id: row.id,
        category: row.category || 'Other',
        amount: Number(row.amount) || 0,
        paymentMethod: row.payment_method || 'cash',
        note: row.note || undefined,
        userId: row.user_id || undefined,
        createdAt: row.created_at || now,
        synced: true,
      })
      added++
    }

    for (const row of movRows ?? []) {
      if (localMovements.has(row.id)) continue
      await db.stockMovements.put({
        id: row.id,
        productId: row.product_id,
        productName: row.product_name || '',
        type: row.type,
        quantity: Number(row.quantity) || 0,
        previousStock: Number(row.previous_stock) || 0,
        newStock: Number(row.new_stock) || 0,
        reason: row.reason || undefined,
        referenceId: row.reference_id || undefined,
        userId: row.user_id || undefined,
        createdAt: row.created_at || now,
        synced: true,
      })
      added++
    }
  })

  try { localStorage.setItem(lastPullKey(), nowIso) } catch { /* ignore */ }
  return added
}

export async function syncNow() {
  const result = await processOutbox()
  const pending = await db.outbox.count()
  const pulled = result.failed === 0 && pending === 0 ? await pullMissing().catch(() => 0) : 0
  return { ...result, pulled, pending }
}

export function startRealtime(onChange?: () => void): () => void {
  if (!supabaseConfigured || !supabase) return () => {}
  const businessId = getBusinessId()
  if (!businessId) return () => {}

  const channel = supabase
    .channel(`biz-${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` },
      () => { void pullMissing().then(() => onChange?.()) },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers', filter: `business_id=eq.${businessId}` },
      () => { void pullMissing().then(() => onChange?.()) },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sales', filter: `business_id=eq.${businessId}` },
      () => { void pullMissing().then(() => onChange?.()) },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export function startSyncLoop(intervalMs = 20000) {
  let ticks = 0
  const tick = async () => {
    if (!navigator.onLine) return
    const result = await processOutbox()
    if (result.synced > 0) console.info(`Synced ${result.synced} events`)
    // Full pull on first tick and every ~2 minutes
    if (ticks++ % 6 === 0) await pullMissing().catch(() => 0)
  }
  tick()
  return window.setInterval(tick, intervalMs)
}

export function getLastSyncAt(): string | null {
  try { return localStorage.getItem(LAST_SYNC_KEY) } catch { return null }
}

export function getLastPullAt(): string | null {
  try { return localStorage.getItem(lastPullKey()) } catch { return null }
}
