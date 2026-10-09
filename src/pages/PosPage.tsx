import { useEffect, useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, ShoppingCart, Wifi, WifiOff, Plus, Minus, Trash2, X } from 'lucide-react'
import { db } from '../lib/db'
import { usePosStore } from '../store/posStore'
import type { Product, Payment, Sale } from '../types'
import ReceiptModal from '../components/ReceiptModal'
import { useNavigate } from 'react-router-dom'

export default function PosPage() {
  const navigate = useNavigate()
  const {
    cart,
    searchQuery,
    setSearchQuery,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    isOnline,
    pendingSyncCount,
    completeSale,
    setCustomer,
    selectedCustomerName,
    applyCartDiscount,
  } = usePosStore()

  const [showPay, setShowPay] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'mobile' | 'bank'>('cash')
  const [discountInput, setDiscountInput] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')

  const products = useLiveQuery(
    () =>
      db.products
        .filter((p) => p.active)
        .toArray(),
    []
  ) || []

  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []) || []

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return products
    const q = searchQuery.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
    )
  }, [products, searchQuery])

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0)

  useEffect(() => {
    const user = sessionStorage.getItem('currentUser')
    if (!user) navigate('/login')
  }, [navigate])

  // Simple barcode scanner support (keyboard wedge)
  useEffect(() => {
    let buffer = ''
    let timeout: ReturnType<typeof setTimeout>
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buffer.length > 3) {
        const product = products.find((p) => p.barcode === buffer)
        if (product) {
          addToCart(product)
          setSearchQuery('')
        }
        buffer = ''
      } else if (e.key.length === 1) {
        buffer += e.key
        clearTimeout(timeout)
        timeout = setTimeout(() => (buffer = ''), 100)
      }
    }
    window.addEventListener('keypress', handler)
    return () => window.removeEventListener('keypress', handler)
  }, [products, addToCart, setSearchQuery])

  const cartDiscount = cart.reduce((s, i) => s + i.discount, 0)
  const payTotal = subtotal  // subtotal already has line discounts applied

  const handlePay = async () => {
    const amount = parseFloat(cashReceived) || payTotal
    const payments: Payment[] = [{ method: payMethod, amount }]
    try {
      const sale = await completeSale(payments)
      setLastSale(sale)
      setShowPay(false)
      setCashReceived('')
      setDiscountInput('')
      setPayMethod('cash')
      setCustomerQuery('')
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const applyDiscount = () => {
    const d = parseFloat(discountInput) || 0
    if (d > 0) applyCartDiscount(d)
  }

  const filteredCustomers = customerQuery.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(customerQuery))
      ).slice(0, 5)
    : []

  return (
    <div className="h-full flex flex-col md:flex-row bg-surface-secondary">
      {/* Left / Main: Products */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-ink tracking-tight">StockFlow</h1>
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
              isOnline ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'
            }`}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            {pendingSyncCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {pendingSyncCount} pending
              </span>
            )}
          </div>

        </header>

        {/* Search */}
        <div className="px-4 py-3 bg-white border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, SKU or scan barcode…"
              className="w-full h-11 pl-10 pr-4 rounded-button bg-surface-secondary border border-transparent
                focus:border-primary focus:bg-white outline-none transition-smooth text-ink"
              autoFocus
            />
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-ink-muted mt-12">No products found</p>
          )}
        </div>
      </div>

      {/* Right: Cart (desktop) / Bottom sheet trigger (mobile) */}
      <aside className="hidden md:flex w-[380px] flex-col bg-white border-l border-border shrink-0">
        <CartPanel
          cart={cart}
          subtotal={subtotal}
          onUpdateQty={updateQuantity}
          onRemove={removeFromCart}
          onClear={clearCart}
          onPay={() => setShowPay(true)}
        />
      </aside>

      {/* Mobile floating cart button */}
      <div className="md:hidden fixed bottom-6 right-4 z-20">
        <button
          onClick={() => setShowPay(true)}
          className="relative h-14 w-14 rounded-full bg-primary text-white shadow-lg
            flex items-center justify-center active:scale-95 transition-smooth"
        >
          <ShoppingCart size={22} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-danger text-xs
              flex items-center justify-center font-medium">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Payment / Cart sheet (mobile + desktop modal) */}
      {lastSale && (
        <ReceiptModal sale={lastSale} onClose={() => setLastSale(null)} />
      )}

      {showPay && (
        <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full md:max-w-md bg-white rounded-t-2xl md:rounded-card shadow-xl
            max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
            <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h2 className="text-lg font-semibold">Cart & Payment</h2>
                  <button onClick={() => setShowPay(false)} className="p-1 text-ink-muted hover:text-ink">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-5">
                  {cart.length === 0 ? (
                    <p className="text-center text-ink-muted py-8">Cart is empty</p>
                  ) : (
                    <>
                      <ul className="space-y-3 mb-6">
                        {cart.map((item) => (
                          <li key={item.productId} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-ink truncate">{item.name}</p>
                              <p className="text-sm text-ink-secondary tabular-nums">
                                {item.price.toLocaleString()} × {item.quantity}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                className="h-8 w-8 rounded-full bg-surface-secondary flex items-center justify-center"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-6 text-center tabular-nums">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                className="h-8 w-8 rounded-full bg-surface-secondary flex items-center justify-center"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <p className="w-20 text-right font-medium tabular-nums">
                              {item.lineTotal.toLocaleString()}
                            </p>
                            <button onClick={() => removeFromCart(item.productId)} className="text-ink-muted hover:text-danger">
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>

                      {/* Customer */}
                      <div className="mb-4">
                        <label className="block text-sm text-ink-secondary mb-1.5">Customer (optional)</label>
                        {selectedCustomerName ? (
                          <div className="flex items-center justify-between h-11 px-3 rounded-button bg-primary/5 border border-primary/20">
                            <span className="text-sm font-medium text-ink">{selectedCustomerName}</span>
                            <button
                              onClick={() => { setCustomer(null, null); setCustomerQuery('') }}
                              className="text-xs text-ink-muted hover:text-danger"
                            >
                              Clear
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              value={customerQuery}
                              onChange={(e) => setCustomerQuery(e.target.value)}
                              placeholder="Search customer…"
                              className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm"
                            />
                            {filteredCustomers.length > 0 && (
                              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white rounded-button shadow-card border border-border overflow-hidden">
                                {filteredCustomers.map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => { setCustomer(c.id, c.name); setCustomerQuery('') }}
                                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-surface-secondary transition-smooth"
                                  >
                                    {c.name}
                                    {c.phone && <span className="text-ink-muted ml-2">{c.phone}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Discount */}
                      <div className="mb-4 flex gap-2">
                        <div className="flex-1">
                          <label className="block text-sm text-ink-secondary mb-1.5">Discount</label>
                          <input
                            type="number"
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                            placeholder="0"
                            className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm tabular-nums"
                          />
                        </div>
                        <button
                          onClick={applyDiscount}
                          className="self-end h-11 px-4 rounded-button bg-surface-secondary text-sm font-medium text-ink hover:bg-border transition-smooth"
                        >
                          Apply
                        </button>
                      </div>

                      <div className="border-t border-border pt-4 space-y-2">
                        {cartDiscount > 0 && (
                          <div className="flex justify-between text-ink-secondary">
                            <span>Discount</span>
                            <span className="tabular-nums text-danger">-{cartDiscount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-semibold text-ink">
                          <span>Total</span>
                          <span className="tabular-nums">{payTotal.toLocaleString()} TZS</span>
                        </div>
                      </div>

                      {/* Payment method */}
                      <div className="mt-4">
                        <label className="block text-sm text-ink-secondary mb-1.5">Payment method</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['cash', 'mobile', 'card', 'bank'] as const).map(m => (
                            <button
                              key={m}
                              onClick={() => setPayMethod(m)}
                              className={`h-10 rounded-button text-xs font-medium capitalize transition-smooth ${
                                payMethod === m
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-secondary text-ink-secondary hover:bg-border'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm text-ink-secondary mb-1.5">
                          {payMethod === 'cash' ? 'Cash received' : 'Amount'}
                        </label>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={payTotal.toString()}
                          className="w-full h-12 px-4 rounded-button bg-surface-secondary border border-transparent
                            focus:border-primary outline-none tabular-nums text-lg"
                        />
                        {payMethod === 'cash' && cashReceived && parseFloat(cashReceived) >= payTotal && (
                          <p className="mt-2 text-sm text-success">
                            Change: {(parseFloat(cashReceived) - payTotal).toLocaleString()} TZS
                          </p>
                        )}
                      </div>

                      <button
                        onClick={handlePay}
                        className="mt-6 w-full h-14 rounded-button bg-primary text-white text-lg font-semibold
                          hover:bg-primary-hover active:scale-[0.98] transition-smooth"
                      >
                        Complete Sale
                      </button>
                      <button
                        onClick={clearCart}
                        className="mt-3 w-full h-10 text-sm text-ink-secondary hover:text-danger"
                      >
                        Clear cart
                      </button>
                    </>
                  )}
                </div>
              </>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="group flex flex-col bg-white rounded-card shadow-card p-3 text-left
        hover:shadow-soft active:scale-[0.98] transition-smooth border border-transparent hover:border-border"
    >
      <div className="aspect-square rounded-lg bg-surface-secondary mb-3 flex items-center justify-center">
        <span className="text-2xl font-semibold text-ink-muted">
          {product.name.charAt(0)}
        </span>
      </div>
      <p className="font-medium text-ink text-sm leading-snug line-clamp-2">{product.name}</p>
      <p className="mt-1 text-xs text-ink-muted">{product.sku}</p>
      <div className="mt-auto pt-2 flex items-center justify-between">
        <span className="font-semibold text-ink tabular-nums text-sm">
          {product.price.toLocaleString()}
        </span>
        <span className={`text-xs ${product.stock < 10 ? 'text-warning' : 'text-ink-muted'}`}>
          {product.stock} left
        </span>
      </div>
    </button>
  )
}

function CartPanel({
  cart,
  subtotal,
  onUpdateQty,
  onClear,
  onPay,
}: {
  cart: ReturnType<typeof usePosStore.getState>['cart']
  subtotal: number
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  onPay: () => void
}) {
  return (
    <>
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-ink">Current Sale</h2>
        <p className="text-sm text-ink-secondary">{cart.length} items</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 && (
          <p className="text-center text-ink-muted py-12">Scan or tap products to add</p>
        )}
        {cart.map((item) => (
          <div key={item.productId} className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-ink truncate">{item.name}</p>
              <p className="text-xs text-ink-secondary tabular-nums">
                {item.price.toLocaleString()} × {item.quantity}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                className="h-7 w-7 rounded-full bg-surface-secondary flex items-center justify-center text-ink"
              >
                <Minus size={12} />
              </button>
              <span className="w-5 text-center text-sm tabular-nums">{item.quantity}</span>
              <button
                onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
                className="h-7 w-7 rounded-full bg-surface-secondary flex items-center justify-center text-ink"
              >
                <Plus size={12} />
              </button>
            </div>
            <p className="w-16 text-right text-sm font-medium tabular-nums">
              {item.lineTotal.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="p-5 border-t border-border space-y-3">
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{subtotal.toLocaleString()} TZS</span>
        </div>
        <button
          onClick={onPay}
          disabled={cart.length === 0}
          className="w-full h-12 rounded-button bg-primary text-white font-semibold
            disabled:opacity-40 hover:bg-primary-hover active:scale-[0.98] transition-smooth"
        >
          Charge
        </button>
        {cart.length > 0 && (
          <button onClick={onClear} className="w-full text-sm text-ink-secondary hover:text-danger">
            Clear
          </button>
        )}
      </div>
    </>
  )
}
