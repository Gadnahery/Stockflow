import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CartItem, Product, Payment, Sale, StockMovement, HeldCart } from '../types'
import { db, audit } from '../lib/db'

interface PosState {
  cart: CartItem[]
  searchQuery: string
  isOnline: boolean
  pendingSyncCount: number
  currentSaleId: string | null
  selectedCustomerId: string | null
  selectedCustomerName: string | null

  setSearchQuery: (q: string) => void
  addToCart: (product: Product, qty?: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  setOnline: (online: boolean) => void
  refreshPendingSync: () => Promise<void>
  setCustomer: (id: string | null, name: string | null) => void
  applyLineDiscount: (productId: string, discount: number) => void
  applyCartDiscount: (discount: number) => void
  completeSale: (payments: Payment[]) => Promise<Sale>
  voidSale: (saleId: string) => Promise<void>
  held: HeldCart[]
  holdCart: () => boolean
  resumeHeld: (id: string) => boolean
  deleteHeld: (id: string) => void
}

const HELD_KEY = 'heldCarts'
const loadHeld = (): HeldCart[] => { try { return JSON.parse(localStorage.getItem(HELD_KEY) || '[]') } catch { return [] } }
const saveHeld = (h: HeldCart[]) => localStorage.setItem(HELD_KEY, JSON.stringify(h))

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('currentUser') || '{}')
  } catch {
    return {}
  }
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  searchQuery: '',
  isOnline: navigator.onLine,
  pendingSyncCount: 0,
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

  addToCart: (product, qty = 1) => {
    set((state) => {
      const existing = state.cart.find((i) => i.productId === product.id)
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.productId === product.id
              ? {
                  ...i,
                  quantity: i.quantity + qty,
                  lineTotal: (i.quantity + qty) * i.price - i.discount,
                }
              : i
          ),
        }
      }
      return {
        cart: [
          ...state.cart,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            imageUrl: product.imageUrl,
            price: product.price,
            quantity: qty,
            discount: 0,
            lineTotal: product.price * qty,
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
    await db.transaction('rw', db.sales, db.products, db.stockMovements, db.outbox, db.customers, async () => {
      await db.sales.update(saleId, { status: 'voided', synced: false })
      if (creditAmt > 0 && sale.customerId) {
        const c = await db.customers.get(sale.customerId)
        if (c) await db.customers.update(c.id, { balance: Math.max(0, c.balance - creditAmt), updatedAt: now })
      }

      // Restock
      for (const item of sale.items) {
        const product = await db.products.get(item.productId)
        if (!product) continue
        const previousStock = product.stock
        const newStock = previousStock + item.quantity
        await db.products.update(item.productId, { stock: newStock, updatedAt: now })
        await db.stockMovements.add({
          id: uuidv4(),
          productId: item.productId,
          productName: item.name,
          type: 'return',
          quantity: item.quantity,
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
  },

  completeSale: async (payments) => {
    const { cart, selectedCustomerId, selectedCustomerName } = get()
    if (cart.length === 0) throw new Error('Cart is empty')

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

    // Find open shift if any
    const openShift = await db.cashSessions.filter((s) => s.status === 'open').first()

    const sale: Sale = {
      id: saleId,
      deviceId,
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
      createdAt: now,
      synced: false,
    }

    await db.transaction('rw', db.sales, db.products, db.stockMovements, db.outbox, db.customers, async () => {
      await db.sales.add(sale)
      if (creditAmt > 0 && selectedCustomerId) {
        const c = await db.customers.get(selectedCustomerId)
        if (c) await db.customers.update(c.id, { balance: c.balance + creditAmt, updatedAt: now })
      }

      for (const item of cart) {
        const product = await db.products.get(item.productId)
        if (!product) continue

        const previousStock = product.stock
        const newStock = Math.max(0, previousStock - item.quantity)

        await db.products.update(item.productId, {
          stock: newStock,
          updatedAt: now,
        })

        const movement: StockMovement = {
          id: uuidv4(),
          productId: item.productId,
          productName: item.name,
          type: 'sale',
          quantity: -item.quantity,
          previousStock,
          newStock,
          referenceId: saleId,
          userId: user.id,
          createdAt: now,
          synced: false,
        }
        await db.stockMovements.add(movement)
      }

      await db.outbox.add({
        id: uuidv4(),
        type: 'sale',
        payload: sale,
        createdAt: now,
        retries: 0,
      })
    })

    set({ cart: [], currentSaleId: saleId, selectedCustomerId: null, selectedCustomerName: null })
    if (sale.discount > 0) await audit('SALE_DISCOUNT', 'sale', saleId, { after: { discount: sale.discount, total: sale.total }, reason: `Receipt ${receiptNumber}` })
    await get().refreshPendingSync()
    return sale
  },
}))
