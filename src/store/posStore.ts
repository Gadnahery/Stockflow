import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CartItem, Product, Payment, Sale, StockMovement, HeldCart } from '../types'
import { db, audit } from '../lib/db'
import { processOutbox } from '../lib/sync'
import { applyStockChange } from '../lib/stock'

interface PosState {
  cart: CartItem[]
  searchQuery: string
  isOnline: boolean
  pendingSyncCount: number
  catalogTick: number
  currentSaleId: string | null
  selectedCustomerId: string | null
  selectedCustomerName: string | null

  setSearchQuery: (q: string) => void
  addToCart: (product: Product, qty?: number, sellAs?: 'unit' | 'pack') => void
  updateQuantity: (productId: string, quantity: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  setOnline: (online: boolean) => void
  refreshPendingSync: () => Promise<void>
  setCustomer: (id: string | null, name: string | null) => void
  applyLineDiscount: (productId: string, discount: number) => void
  applyCartDiscount: (discount: number) => void
  completeSale: (payments: Payment[], note?: string) => Promise<Sale>
  voidSale: (saleId: string) => Promise<void>
  refundSale: (saleId: string) => Promise<void>
  held: HeldCart[]
  holdCart: () => boolean
  resumeHeld: (id: string) => boolean
  deleteHeld: (id: string) => void
}

const HELD_KEY = 'heldCarts'
const loadHeld = (): HeldCart[] => { try { return JSON.parse(localStorage.getItem(HELD_KEY) || '[]') } catch { return [] } }
const saveHeld = (h: HeldCart[]) => localStorage.setItem(HELD_KEY, JSON.stringify(h))

function getCurrentUser(): { id: string; name: string } {
  try {
    const u = JSON.parse(sessionStorage.getItem('currentUser') || '{}') as { id?: string; name?: string }
    return {
      id: u.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('deviceId') : null) || 'local',
      name: u.name || 'Cashier',
    }
  } catch {
    return {
      id: (typeof localStorage !== 'undefined' ? localStorage.getItem('deviceId') : null) || 'local',
      name: 'Cashier',
    }
  }
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  searchQuery: '',
  isOnline: navigator.onLine,
  pendingSyncCount: 0,
  catalogTick: 0,
  currentSaleId: null,
  selectedCustomerId: null,
  selectedCustomerName: null,
  held: loadHeld(),

  holdCart: () => {
    const { cart, selectedCustomerId, selectedCustomerName, held } = get()
    if (cart.length === 0) return false
    const next = [...held, { id: uuidv4(), items: cart, customerId: selectedCustomerId, customerName: selectedCustomerName, createdAt: new Date().toISOString() }]
    saveHeld(next)
    set({ held: next, cart: [], selectedCustomerId: null, selectedCustomerName: null })
    return true
  },
  resumeHeld: (id) => {
    const { held, cart } = get()
    const h = held.find((x) => x.id === id)
    if (!h || cart.length > 0) return false
    const next = held.filter((x) => x.id !== id)
    saveHeld(next)
    set({ held: next, cart: h.items, selectedCustomerId: h.customerId, selectedCustomerName: h.customerName })
    return true
  },
  deleteHeld: (id) => { const next = get().held.filter((x) => x.id !== id); saveHeld(next); set({ held: next }) },

  setSearchQuery: (q) => set({ searchQuery: q }),

  setCustomer: (id, name) => set({ selectedCustomerId: id, selectedCustomerName: name }),

  addToCart: (product, qty = 1, sellAs = 'unit') => {
    const asPack = sellAs === 'pack' && (product.packQty || 0) > 1
    const packQty = product.packQty || 1
    const unitPrice = asPack ? (product.packPrice ?? product.price * packQty) : product.price
    const stockPerSale = asPack ? packQty : 1
    const unitLabel = asPack ? (product.packName || 'pack') : (product.unit || 'pc')
    // Cart lines for pack vs unit are separate keys via name suffix in matching
    set((state) => {
      const existing = state.cart.find(
        (i) => i.productId === product.id && (i.sellAs || 'unit') === (asPack ? 'pack' : 'unit'),
      )
      const inCart = existing?.quantity ?? 0
      const stockUsed = state.cart
        .filter((i) => i.productId === product.id)
        .reduce((s, i) => s + (i.stockUnits ?? i.quantity), 0)
      const maxStock = Math.max(0, product.stock)
      const remaining = maxStock - stockUsed
      if (remaining < stockPerSale) return state
      const canAdd = Math.floor(remaining / stockPerSale)
      const nextQty = Math.min(inCart + qty, inCart + canAdd)
      if (nextQty <= inCart && existing) return state
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.productId === product.id && (i.sellAs || 'unit') === (asPack ? 'pack' : 'unit')
              ? {
                  ...i,
                  quantity: nextQty,
                  stockUnits: nextQty * stockPerSale,
                  lineTotal: nextQty * i.price - i.discount,
                }
              : i,
          ),
        }
      }
      const q = Math.min(qty, canAdd)
      if (q <= 0) return state
      return {
        cart: [
          ...state.cart,
          {
            productId: product.id,
            name: asPack ? `${product.name} (${unitLabel})` : product.name,
            sku: product.sku,
            imageUrl: product.imageUrl,
            price: unitPrice,
            quantity: q,
            discount: 0,
            lineTotal: unitPrice * q,
            sellAs: asPack ? 'pack' : 'unit',
            stockUnits: q * stockPerSale,
            unitLabel,
          },
        ],
      }
    })
  },
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId)
      return
    }
    set((state) => ({
      cart: state.cart.map((i) =>
        i.productId === productId
          ? { ...i, quantity, lineTotal: quantity * i.price - i.discount }
          : i
      ),
    }))
  },

  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((i) => i.productId !== productId),
    })),

  clearCart: () =>
    set({ cart: [], currentSaleId: null, selectedCustomerId: null, selectedCustomerName: null }),

  setOnline: (online) => set({ isOnline: online }),

  refreshPendingSync: async () => {
    const count = await db.outbox.count()
    set({ pendingSyncCount: count })
  },

  applyLineDiscount: (productId, discount) => {
    set((state) => ({
      cart: state.cart.map((i) =>
        i.productId === productId
          ? { ...i, discount, lineTotal: i.quantity * i.price - discount }
          : i
      ),
    }))
  },

  applyCartDiscount: (discount) => {
    // Distribute proportionally or apply to first item for simplicity
    set((state) => {
      if (state.cart.length === 0) return state
      const sub = state.cart.reduce((s, i) => s + i.quantity * i.price, 0)
      if (sub <= 0) return state
      return {
        cart: state.cart.map((i) => {
          const share = (i.quantity * i.price) / sub
          const d = Math.round(discount * share * 100) / 100
          return { ...i, discount: d, lineTotal: i.quantity * i.price - d }
        }),
      }
    })
  },

  voidSale: async (saleId) => {
    const sale = await db.sales.get(saleId)
    if (!sale || sale.status !== 'completed') throw new Error('Cannot void this sale')
    const now = new Date().toISOString()
    const user = getCurrentUser()

    const creditAmt = sale.payments.filter((p) => p.method === 'credit').reduce((t, p) => t + p.amount, 0)
    await db.transaction('rw', [db.sales, db.products, db.stockMovements, db.outbox, db.customers, db.branchStock], async () => {
      await db.sales.update(saleId, { status: 'voided', synced: false })
      if (creditAmt > 0 && sale.customerId) {
        const c = await db.customers.get(sale.customerId)
        if (c) await db.customers.update(c.id, { balance: Math.max(0, c.balance - creditAmt), updatedAt: now })
      }

      // Restock (packs restore packQty * quantity base units)
      for (const item of sale.items) {
        const product = await db.products.get(item.productId)
        if (!product || product.isService) continue
        const previousStock = product.stock
        const restock = (item as { stockUnits?: number }).stockUnits ?? item.quantity
        const newStock = previousStock + restock
        await db.products.update(item.productId, { stock: newStock, updatedAt: now })
        await db.stockMovements.add({
          id: uuidv4(),
          productId: item.productId,
          productName: item.name,
          type: 'return',
          quantity: restock,
          previousStock,
          newStock,
          referenceId: saleId,
          reason: 'Sale voided',
          userId: user.id,
          createdAt: now,
          synced: false,
        })
      }

      await db.outbox.add({
        id: uuidv4(),
        type: 'sale',
        payload: { ...sale, status: 'voided' },
        createdAt: now,
        retries: 0,
      })
    })
    await audit('SALE_VOID', 'sale', saleId, { before: { status: 'completed', total: sale.total }, after: { status: 'voided' }, reason: `Receipt ${sale.receiptNumber}` })
    set({ catalogTick: get().catalogTick + 1 })
    await get().refreshPendingSync()
    if (navigator.onLine) {
      void processOutbox().then(() => get().refreshPendingSync()).catch(() => {})
    }
  },

  refundSale: async (saleId) => {
    const sale = await db.sales.get(saleId)
    if (!sale || sale.status !== 'completed') throw new Error('Cannot refund this sale')
    const now = new Date().toISOString()
    const user = getCurrentUser()
    const creditAmt = sale.payments.filter((p) => p.method === 'credit').reduce((t, p) => t + p.amount, 0)

    await db.transaction('rw', [db.sales, db.products, db.stockMovements, db.outbox, db.customers, db.branchStock], async () => {
      await db.sales.update(saleId, { status: 'refunded', synced: false })
      if (creditAmt > 0 && sale.customerId) {
        const c = await db.customers.get(sale.customerId)
        if (c) await db.customers.update(c.id, { balance: Math.max(0, c.balance - creditAmt), updatedAt: now })
      }
      for (const item of sale.items) {
        const product = await db.products.get(item.productId)
        if (!product) continue
        const previousStock = product.stock
        const newStock = previousStock + item.quantity
        await db.products.update(item.productId, { stock: newStock, updatedAt: now })
        const movement = {
          id: uuidv4(),
          productId: item.productId,
          productName: item.name,
          type: 'return' as const,
          quantity: item.quantity,
          previousStock,
          newStock,
          referenceId: saleId,
          reason: 'Sale refunded',
          userId: user.id,
          createdAt: now,
          synced: false,
        }
        await db.stockMovements.add(movement)
        await db.outbox.add({ id: uuidv4(), type: 'stock_movement', payload: movement, createdAt: now, retries: 0 })
        await db.outbox.add({
          id: uuidv4(),
          type: 'product_upsert',
          payload: { ...product, stock: newStock, updatedAt: now },
          createdAt: now,
          retries: 0,
        })
      }
      await db.outbox.add({
        id: uuidv4(),
        type: 'sale',
        payload: { ...sale, status: 'refunded' },
        createdAt: now,
        retries: 0,
      })
    })
    await audit('SALE_REFUND', 'sale', saleId, {
      before: { status: 'completed', total: sale.total },
      after: { status: 'refunded' },
      reason: `Receipt ${sale.receiptNumber}`,
    })
    set({ catalogTick: get().catalogTick + 1 })
    await get().refreshPendingSync()
    if (navigator.onLine) {
      void processOutbox().then(() => get().refreshPendingSync()).catch(() => {})
    }
  },

  completeSale: async (payments, note) => {
    const { cart, selectedCustomerId, selectedCustomerName } = get()
    if (cart.length === 0) throw new Error('Cart is empty')
    // Beta access is unrestricted: selling must not depend on a stale cached billing flag.

    const settings = await db.settings.get('main')
    const taxRate = settings?.taxRate ?? 0
    const taxInclusive = settings?.taxInclusive ?? true
    const deviceId = settings?.deviceId || 'unknown'

    const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0)
    let tax = 0
    let total = subtotal

    if (taxRate > 0) {
      if (taxInclusive) {
        tax = subtotal - subtotal / (1 + taxRate / 100)
        total = subtotal
      } else {
        tax = subtotal * (taxRate / 100)
        total = subtotal + tax
      }
    }

    const paid = payments.reduce((s, p) => s + p.amount, 0)
    if (paid < total - 0.01) throw new Error(`Short by ${Math.round(total - paid).toLocaleString()} — add another payment or use Credit`)

    const creditAmt = payments.filter((p) => p.method === 'credit').reduce((t, p) => t + p.amount, 0)
    if (creditAmt > 0) {
      if (!selectedCustomerId) throw new Error('Select a customer to sell on credit')
      const c = await db.customers.get(selectedCustomerId)
      if (!c) throw new Error('Customer not found')
      if (c.balance + creditAmt > c.creditLimit + 0.01) {
        throw new Error(`Credit limit exceeded: limit ${c.creditLimit.toLocaleString()}, already owes ${c.balance.toLocaleString()}`)
      }
    }

    const user = getCurrentUser()
    const now = new Date().toISOString()
    const saleId = uuidv4()
    const receiptNumber = `R${Date.now().toString().slice(-8)}`
    const fiscalMode = settings?.fiscalMode || 'off'
    let fiscalReceiptNumber: string | undefined
    if (fiscalMode === 'prepare' || fiscalMode === 'vfd') {
      const next = (settings?.fiscalReceiptSeq ?? 0) + 1
      fiscalReceiptNumber = `FS${String(next).padStart(8, '0')}`
      await db.settings.update('main', { fiscalReceiptSeq: next })
    }

    // Find open shift if any
    const openShift = await db.cashSessions.filter((s) => s.status === 'open').first()

    const branchId =
      settings?.branchId ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('branchId') || undefined : undefined)

    const sale: Sale = {
      id: saleId,
      deviceId,
      branchId: branchId || undefined,
      items: [...cart],
      subtotal,
      discount: cart.reduce((s, i) => s + i.discount, 0),
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
      payments,
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomerName || undefined,
      cashierId: user.id,
      cashierName: user.name,
      shiftId: openShift?.id,
      status: 'completed',
      receiptNumber,
      fiscalReceiptNumber,
      note: note?.trim() || undefined,
      createdAt: now,
      synced: false,
    }

    try {
      await db.transaction('rw', [db.sales, db.products, db.stockMovements, db.outbox, db.customers, db.branchStock], async () => {
      await db.sales.add(sale)
      if (creditAmt > 0 && selectedCustomerId) {
        const c = await db.customers.get(selectedCustomerId)
        if (c) await db.customers.update(c.id, { balance: c.balance + creditAmt, updatedAt: now })
      }

      const movements: StockMovement[] = []
      for (const item of cart) {
        const product = await db.products.get(item.productId)
        if (!product) continue
        if (product.isService) continue

        const deduct = item.stockUnits ?? item.quantity
        // Respect shared vs per-branch stock mode (catalogue stays shared)
        const { previous, next } = await applyStockChange({
          productId: item.productId,
          productName: item.name,
          delta: -deduct,
          branchId: branchId || null,
          now,
        })

        const movement: StockMovement = {
          id: uuidv4(),
          productId: item.productId,
          productName: item.name,
          type: 'sale',
          quantity: -deduct,
          previousStock: previous,
          newStock: next,
          referenceId: saleId,
          branchId: branchId || undefined,
          userId: user.id,
          createdAt: now,
          synced: false,
        }
        await db.stockMovements.add(movement)
        movements.push(movement)
      }

      await db.outbox.add({
        id: uuidv4(),
        type: 'sale',
        payload: sale,
        createdAt: now,
        retries: 0,
      })
      // Keep remote stock + ledger in lockstep with the sale
      for (const movement of movements) {
        const product = await db.products.get(movement.productId)
        if (product) {
          await db.outbox.add({
            id: uuidv4(),
            type: 'product_upsert',
            payload: product,
            createdAt: now,
            retries: 0,
          })
        }
        await db.outbox.add({
          id: uuidv4(),
          type: 'stock_movement',
          payload: movement,
          createdAt: now,
          retries: 0,
        })
      }
    })
    } catch (txErr) {
      const msg = txErr instanceof Error ? txErr.message : 'Could not save sale'
      throw new Error(msg.includes('Quota') ? 'Device storage full — free space and try again' : msg)
    }

    // Unlock UI immediately — never wait on audit/sync
    set({ cart: [], currentSaleId: saleId, selectedCustomerId: null, selectedCustomerName: null, catalogTick: get().catalogTick + 1 })
    try {
      if (sale.discount > 0) {
        await audit('SALE_DISCOUNT', 'sale', saleId, {
          after: { discount: sale.discount, total: sale.total },
          reason: `Receipt ${receiptNumber}`,
        })
      }
    } catch { /* never block sale */ }
    try {
      await get().refreshPendingSync()
    } catch { /* ignore */ }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void processOutbox().then(() => get().refreshPendingSync()).catch(() => {})
    }
    return sale
  },
}))
