/**
 * Offline → Supabase sync engine
 * Pushes outbox events when online; maps local Dexie models to existing Supabase schema.
 */
import { db } from './db'
import { supabase, supabaseConfigured, getBusinessId, setBusinessId } from './supabase'
import type { Sale, Product, Customer, Expense, StockMovement, OutboxEvent } from '../types'

const DEFAULT_BUSINESS_ID = 'a0000000-0000-4000-8000-000000000001'
const DEFAULT_BRANCH_ID = 'b0000000-0000-4000-8000-000000000001'

async function ensureBusiness(): Promise<string> {
  let id = getBusinessId()
  if (id) return id

  if (!supabaseConfigured || !supabase) throw new Error('Supabase not configured')

  // Try existing businesses
  const { data: existing } = await supabase.from('businesses').select('id').limit(1)
  if (existing && existing.length > 0) {
    setBusinessId(existing[0].id)
    return existing[0].id
  }

  // Fall back to seed demo business on this project
  setBusinessId(DEFAULT_BUSINESS_ID)
  return DEFAULT_BUSINESS_ID
}

function getBranchId(): string {
  return localStorage.getItem('branchId') || DEFAULT_BRANCH_ID
}

async function syncSale(sale: Sale, businessId: string) {
  if (!supabase) return

  const { error } = await supabase.from('sales').upsert({
    id: sale.id,
    business_id: businessId,
    branch_id: sale.branchId || getBranchId(),
    subtotal: sale.subtotal,
    discount_total: sale.discount,
    tax_total: sale.tax,
    total: sale.total,
    status: sale.status,
    receipt_number: sale.receiptNumber,
    cashier_name: sale.cashierName,
    customer_name: sale.customerName,
    customer_id: sale.customerId || null,
    device_id: sale.deviceId,
    payments: sale.payments,
    note: sale.note,
    created_at: sale.createdAt,
    client_created_at: sale.createdAt,
  }, { onConflict: 'id' })

  if (error) {
    // branch_id might be required UUID of real branch — try without strict branch
    console.warn('sale upsert', error.message)
    throw error
  }

  // sale_items
  for (const item of sale.items) {
    await supabase.from('sale_items').upsert({
      id: crypto.randomUUID(),
      sale_id: sale.id,
      business_id: businessId,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      discount_amount: item.discount,
      tax_amount: 0,
      line_total: item.lineTotal,
    })
  }
}

async function syncProduct(product: Product, businessId: string) {
  if (!supabase) return
  const { error } = await supabase.from('products').upsert({
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
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncCustomer(customer: Customer, businessId: string) {
  if (!supabase) return
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
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncExpense(expense: Expense, businessId: string) {
  if (!supabase) return
  const { error } = await supabase.from('expenses').upsert({
    id: expense.id,
    business_id: businessId,
    category: expense.category,
    amount: expense.amount,
    expense_date: expense.createdAt.slice(0, 10),
    note: expense.note || null,
    created_by: expense.userId || null,
    created_at: expense.createdAt,
  }, { onConflict: 'id' })
  if (error) throw error
}

async function syncStockMovement(m: StockMovement, businessId: string) {
  if (!supabase) return
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
    reference_id: m.referenceId || null,
    user_id: m.userId || null,
    created_at: m.createdAt,
  }, { onConflict: 'id' })
  if (error) throw error
}

export async function processOutbox(): Promise<{ synced: number; failed: number }> {
  if (!supabaseConfigured || !navigator.onLine) {
    return { synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0

  try {
    const businessId = await ensureBusiness()
    const events = await db.outbox.orderBy('createdAt').toArray()

    for (const event of events) {
      try {
        await processEvent(event, businessId)
        await db.outbox.delete(event.id)
        synced++
      } catch (err) {
        failed++
        await db.outbox.update(event.id, {
          retries: event.retries + 1,
          lastError: err instanceof Error ? err.message : String(err),
        })
        console.warn('sync failed', event.type, err)
      }
    }
  } catch (err) {
    console.warn('processOutbox', err)
  }

  return { synced, failed }
}

async function processEvent(event: OutboxEvent, businessId: string) {
  const payload = event.payload as Record<string, unknown>

  switch (event.type) {
    case 'sale':
      await syncSale(payload as unknown as Sale, businessId)
      // mark local sale synced
      if (payload.id) {
        await db.sales.update(String(payload.id), { synced: true })
      }
      break
    case 'product_upsert':
      await syncProduct(payload as unknown as Product, businessId)
      break
    case 'customer_upsert':
      await syncCustomer(payload as unknown as Customer, businessId)
      break
    case 'expense':
      await syncExpense(payload as unknown as Expense, businessId)
      break
    case 'stock_movement':
      await syncStockMovement(payload as unknown as StockMovement, businessId)
      break
    default:
      console.info('unhandled outbox type', event.type)
  }
}

/** Pull products from cloud into local DB (simple full refresh for now) */
export async function pullProducts(): Promise<number> {
  if (!supabaseConfigured || !supabase || !navigator.onLine) return 0
  const businessId = getBusinessId()
  if (!businessId) return 0

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)

  if (error || !data) return 0

  const now = new Date().toISOString()
  for (const row of data) {
    await db.products.put({
      id: row.id,
      name: row.name,
      sku: row.sku || row.id.slice(0, 8),
      barcode: row.barcode || undefined,
      price: Number(row.unit_price) || 0,
      cost: Number(row.cost) || 0,
      stock: Number(row.stock_quantity) || 0,
      minStock: Number(row.min_stock) || undefined,
      category: row.category || undefined,
      unit: row.unit || 'piece',
      active: row.is_active !== false,
      createdAt: row.created_at || now,
      updatedAt: row.updated_at || now,
    })
  }
  return data.length
}

export function startSyncLoop(intervalMs = 30000) {
  const tick = async () => {
    if (navigator.onLine) {
      const result = await processOutbox()
      if (result.synced > 0) {
        console.info(`Synced ${result.synced} events`)
      }
    }
  }
  tick()
  return window.setInterval(tick, intervalMs)
}
