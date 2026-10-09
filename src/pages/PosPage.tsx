import { useEffect, useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, ShoppingBag, Wifi, WifiOff, Plus, Minus, Trash2, ScanLine, ChevronRight, Check } from 'lucide-react'
import { db } from '../lib/db'
import { usePosStore } from '../store/posStore'
import { useUi } from '../store/uiStore'
import type { Product, Payment, Sale } from '../types'
import ReceiptModal from '../components/ReceiptModal'
import Sheet from '../components/ui/Sheet'
import BarcodeScanner from '../components/ui/BarcodeScanner'
import ProductImage from '../components/ui/ProductImage'
import { useTabCompact } from '../hooks/useTabCompact'
import { fmt, haptic } from '../lib/util'
import { useNavigate } from 'react-router-dom'

const METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'card', label: 'Card' },
  { id: 'bank', label: 'Bank' },
] as const

export default function PosPage() {
  const navigate = useNavigate()
  const toast = useUi((s) => s.toast)
  const onScroll = useTabCompact()
  const {
    cart, searchQuery, setSearchQuery, addToCart, updateQuantity, removeFromCart, clearCart,
    isOnline, pendingSyncCount, completeSale, setCustomer, selectedCustomerName, applyCartDiscount,
  } = usePosStore()

  const [showPay, setShowPay] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [payMethod, setPayMethod] = useState<(typeof METHODS)[number]['id']>('cash')
  const [discountInput, setDiscountInput] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [paying, setPaying] = useState(false)

  const productsQ = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), [])
  const products = useMemo(() => productsQ ?? [], [productsQ])
  const loading = productsQ === undefined
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []) || []
  const settings = useLiveQuery(() => db.settings.get('main'), [])

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort()],
    [products]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, searchQuery, category])

  const qtyById = useMemo(() => {
    const m = new Map<string, number>()
    cart.forEach((i) => m.set(i.productId, i.quantity))
    return m
  }, [cart])

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartDiscount = cart.reduce((s, i) => s + i.discount, 0)

  // Same maths as the store so "Charge" always matches what completeSale expects
  const taxRate = settings?.taxRate ?? 0
  const taxInclusive = settings?.taxInclusive ?? true
  const tax = taxRate > 0 ? (taxInclusive ? subtotal - subtotal / (1 + taxRate / 100) : subtotal * (taxRate / 100)) : 0
  const payTotal = Math.round((taxInclusive ? subtotal : subtotal + tax) * 100) / 100

  useEffect(() => {
    if (!sessionStorage.getItem('currentUser')) navigate('/login')
  }, [navigate])

  const add = (p: Product) => {
    const inCart = qtyById.get(p.id) ?? 0
    addToCart(p)
    haptic(10)
    if (inCart + 1 > p.stock) toast(`Only ${fmt(p.stock)} of ${p.name} in stock`, 'error')
  }

  const handleScan = (raw: string) => {
    const code = raw.trim()
    const p = products.find((x) => x.barcode === code || x.sku.toLowerCase() === code.toLowerCase())
    if (!p) {
      toast(`No product with code ${code}`, 'error')
      return
    }
    add(p)
    toast(`${p.name} added`, 'success')
  }

  // Hardware (keyboard-wedge) scanners
  useEffect(() => {
    let buffer = ''
    let timeout: ReturnType<typeof setTimeout>
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buffer.length > 3) {
        const product = products.find((p) => p.barcode === buffer)
        if (product) {
          addToCart(product)
          setSearchQuery('')
          haptic(10)
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

  const handlePay = async () => {
    if (paying) return
    const typed = parseFloat(cashReceived)
    const amount = payMethod === 'cash' && typed > 0 ? typed : payTotal
    const payments: Payment[] = [{ method: payMethod, amount }]
    setPaying(true)
    try {
      const sale = await completeSale(payments)
      haptic(30)
      setLastSale(sale)
      setShowPay(false)
      setCashReceived('')
      setDiscountInput('')
      setPayMethod('cash')
      setCustomerQuery('')
      toast('Sale completed', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setPaying(false)
    }
  }

  const applyDiscount = () => {
    const d = parseFloat(discountInput) || 0
    if (d > 0) applyCartDiscount(d)
  }

  const filteredCustomers = customerQuery.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerQuery.toLowerCase()) || (c.phone && c.phone.includes(customerQuery))
      ).slice(0, 5)
    : []

  const typedCash = parseFloat(cashReceived)
  const quickCash = Array.from(
    new Set([payTotal, ...[1000, 5000, 10000, 20000, 50000].map((s) => Math.ceil(payTotal / s) * s)])
  ).filter((v) => v >= payTotal).slice(0, 4)

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Products */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto" onScroll={onScroll}>
        <header className="page-header !pb-3">
          <div className="flex items-center justify-between">
            <h1 className="page-title">StockFlow</h1>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-[12px] font-semibold px-2.5 h-7 rounded-full ${isOnline ? 'bg-emerald-500/10 text-success' : 'bg-amber-500/15 text-warning'}`}>
                {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {pendingSyncCount > 0 && (
                <span className="text-[12px] font-semibold bg-primary/10 text-primary px-2.5 h-7 inline-flex items-center rounded-full tabular-nums">
                  {pendingSyncCount} pending
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={18} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or scan barcode"
                className="field !bg-black/[0.06] pl-10 pr-3 focus:!bg-white"
                autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches}
              />
            </div>
            <button
              onClick={() => setScanning(true)}
              aria-label="Scan barcode with camera"
              className="press h-[46px] w-[46px] shrink-0 rounded-[14px] bg-primary text-white flex items-center justify-center shadow-soft"
            >
              <ScanLine size={22} />
            </button>
          </div>

          {categories.length > 2 && (
            <div className="mt-3 -mx-5 px-5 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`press shrink-0 h-9 px-4 rounded-full text-[14px] font-semibold ${
                    category === c ? 'bg-ink text-white' : 'bg-black/[0.06] text-ink-secondary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="p-4 md:p-6 scroll-pad">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4]" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center mt-16">
              <p className="text-[17px] font-semibold text-ink">No products found</p>
              <p className="text-[15px] text-ink-secondary mt-1">Try a different name, or scan the barcode.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} qty={qtyById.get(product.id) ?? 0} onAdd={() => add(product)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart (desktop) */}
      <aside className="hidden md:flex w-[380px] flex-col glass border-l border-black/5 shrink-0">
        <CartPanel
          cart={cart}
          total={payTotal}
          onUpdateQty={updateQuantity}
          onClear={clearCart}
          onPay={() => setShowPay(true)}
        />
      </aside>

      {/* Cart pill (mobile) — floats above the tab bar, never covered by it */}
      {cart.length > 0 && !showPay && (
        <div className="cart-pill">
          <button
            onClick={() => setShowPay(true)}
            className="press toast-in flex items-center gap-3 h-[58px] pl-2.5 pr-4 rounded-full bg-primary text-white shadow-float"
          >
            <span key={cartCount} className="bump h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-[16px] font-bold tabular-nums">
              {cartCount}
            </span>
            <span className="flex-1 text-left text-[16px] font-semibold">View cart</span>
            <span className="text-[17px] font-bold tabular-nums">{fmt(payTotal)} TZS</span>
            <ChevronRight size={18} className="opacity-80" />
          </button>
        </div>
      )}

      {lastSale && <ReceiptModal sale={lastSale} onClose={() => setLastSale(null)} />}

      <Sheet
        open={showPay}
        onClose={() => setShowPay(false)}
        title="Cart"
        headerAction={
          cart.length > 0 ? (
            <button onClick={() => setScanning(true)} className="press h-9 px-3.5 rounded-full bg-primary/10 text-primary text-[14px] font-semibold flex items-center gap-1.5">
              <ScanLine size={16} /> Scan
            </button>
          ) : undefined
        }
        footer={
          cart.length > 0 ? (
            <button
              onClick={handlePay}
              disabled={paying || (payMethod === 'cash' && typedCash > 0 && typedCash < payTotal)}
              className="press w-full h-14 rounded-[16px] bg-primary text-white text-[17px] font-bold disabled:opacity-40 shadow-soft"
            >
              {paying ? 'Processing…' : `Charge ${fmt(payTotal)} TZS`}
            </button>
          ) : undefined
        }
      >
        {cart.length === 0 ? (
          <div className="text-center py-14">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBag size={28} />
            </div>
            <p className="mt-4 text-[17px] font-semibold text-ink">Your cart is empty</p>
            <p className="text-[15px] text-ink-secondary mt-1">Tap a product or scan its barcode to add it.</p>
            <button onClick={() => { setShowPay(false); setScanning(true) }} className="press mt-5 h-11 px-6 rounded-full bg-primary text-white font-semibold inline-flex items-center gap-2">
              <ScanLine size={18} /> Scan item
            </button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {cart.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 py-3">
                  <ProductImage name={item.name} src={item.imageUrl} className="h-14 w-14 rounded-[14px] shrink-0" textClass="text-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] text-ink truncate">{item.name}</p>
                    <p className="text-[13px] text-ink-secondary tabular-nums">{fmt(item.price)} each</p>
                    <div className="mt-1.5 inline-flex items-center rounded-full bg-black/[0.06]">
                      <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} aria-label="Decrease" className="press h-8 w-8 flex items-center justify-center rounded-full">
                        {item.quantity === 1 ? <Trash2 size={14} className="text-danger" /> : <Minus size={15} />}
                      </button>
                      <span key={item.quantity} className="bump w-8 text-center text-[15px] font-semibold tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} aria-label="Increase" className="press h-8 w-8 flex items-center justify-center rounded-full">
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right self-start pt-1">
                    <p className="font-bold text-[15px] tabular-nums">{fmt(item.lineTotal)}</p>
                    <button onClick={() => removeFromCart(item.productId)} className="mt-1 text-[12px] text-ink-muted hover:text-danger">Remove</button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Customer */}
            <div className="mt-4">
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Customer</label>
              {selectedCustomerName ? (
                <div className="flex items-center justify-between h-12 px-4 rounded-[14px] bg-primary/[0.07]">
                  <span className="text-[15px] font-semibold text-ink">{selectedCustomerName}</span>
                  <button onClick={() => { setCustomer(null, null); setCustomerQuery('') }} className="text-[13px] font-semibold text-primary">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Walk-in — or search a customer" className="field" />
                  {filteredCustomers.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1.5 bg-white rounded-[16px] shadow-float border border-border overflow-hidden">
                      {filteredCustomers.map((c) => (
                        <button key={c.id} onClick={() => { setCustomer(c.id, c.name); setCustomerQuery('') }} className="w-full text-left px-4 py-3 text-[15px] hover:bg-surface-secondary">
                          {c.name}{c.phone && <span className="text-ink-muted ml-2">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discount */}
            <div className="mt-4 flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Discount (TZS)</label>
                <input type="number" inputMode="decimal" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" className="field tabular-nums" />
              </div>
              <button onClick={applyDiscount} className="press h-[46px] px-5 rounded-[14px] bg-black/[0.06] text-[15px] font-semibold">Apply</button>
            </div>

            {/* Totals */}
            <div className="mt-5 rounded-[18px] bg-surface-secondary p-4 space-y-2">
              <Row label="Subtotal" value={fmt(subtotal + cartDiscount)} />
              {cartDiscount > 0 && <Row label="Discount" value={`-${fmt(cartDiscount)}`} danger />}
              {tax > 0 && <Row label={`Tax ${taxRate}%${taxInclusive ? ' (included)' : ''}`} value={fmt(tax)} muted />}
              <div className="flex justify-between items-baseline pt-2 border-t border-black/10">
                <span className="text-[17px] font-bold">Total</span>
                <span className="text-[24px] font-bold tabular-nums tracking-tight">{fmt(payTotal)} <span className="text-[14px] font-semibold text-ink-secondary">TZS</span></span>
              </div>
            </div>

            {/* Payment method — iOS segmented control */}
            <div className="mt-5">
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Payment</label>
              <div className="grid grid-cols-4 p-1 rounded-[14px] bg-black/[0.06]">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPayMethod(m.id)}
                    className={`h-10 rounded-[11px] text-[14px] font-semibold transition-all duration-200 ${
                      payMethod === m.id ? 'bg-white text-ink shadow-soft' : 'text-ink-secondary'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'cash' && (
              <div className="mt-4">
                <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Cash received</label>
                <input type="number" inputMode="decimal" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder={String(payTotal)} className="field !h-14 text-[22px] font-semibold tabular-nums" />
                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {quickCash.map((v) => (
                    <button key={v} onClick={() => setCashReceived(String(v))} className="press shrink-0 h-9 px-4 rounded-full bg-primary/10 text-primary text-[14px] font-semibold tabular-nums">
                      {v === payTotal ? 'Exact' : fmt(v)}
                    </button>
                  ))}
                </div>
                {typedCash > 0 && (
                  typedCash >= payTotal ? (
                    <p className="mt-3 flex items-center gap-1.5 text-[15px] font-semibold text-success">
                      <Check size={16} strokeWidth={3} /> Change: {fmt(typedCash - payTotal)} TZS
                    </p>
                  ) : (
                    <p className="mt-3 text-[14px] font-medium text-danger">{fmt(payTotal - typedCash)} TZS short</p>
                  )
                )}
              </div>
            )}

            <button onClick={clearCart} className="mt-5 w-full h-11 text-[15px] font-medium text-danger">Clear cart</button>
          </>
        )}
      </Sheet>

      {scanning && <BarcodeScanner continuous title="Scan to add" onDetect={handleScan} onClose={() => setScanning(false)} />}
    </div>
  )
}

function Row({ label, value, danger, muted }: { label: string; value: string; danger?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-[15px] ${muted ? 'text-ink-muted' : 'text-ink-secondary'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${danger ? 'text-danger' : ''}`}>{value}</span>
    </div>
  )
}

function ProductCard({ product, qty, onAdd }: { product: Product; qty: number; onAdd: () => void }) {
  const out = product.stock <= 0
  const low = !out && product.stock <= (product.minStock ?? 5)
  return (
    <button
      onClick={onAdd}
      className="press group relative flex flex-col bg-white rounded-[22px] shadow-card p-2.5 text-left overflow-hidden"
    >
      <div className="relative aspect-square rounded-[16px] overflow-hidden">
        <ProductImage name={product.name} src={product.imageUrl} className="h-full w-full" textClass="text-4xl" />
        {qty > 0 && (
          <span key={qty} className="bump absolute top-2 right-2 min-w-[28px] h-7 px-2 rounded-full bg-primary text-white text-[14px] font-bold flex items-center justify-center shadow-soft tabular-nums">
            {qty}
          </span>
        )}
        {(out || low) && (
          <span className={`absolute bottom-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full ${out ? 'bg-danger text-white' : 'bg-amber-100 text-warning'}`}>
            {out ? 'Out of stock' : `${fmt(product.stock)} left`}
          </span>
        )}
      </div>
      <div className="px-1 pt-2.5 pb-1">
        <p className="font-semibold text-ink text-[15px] leading-snug line-clamp-2 min-h-[2.6em]">{product.name}</p>
        <div className="mt-1.5 flex items-baseline justify-between gap-1">
          <span className="font-bold text-ink tabular-nums text-[17px] tracking-tight">{fmt(product.price)}</span>
          {!out && !low && <span className="text-[12px] text-ink-muted tabular-nums">{fmt(product.stock)} left</span>}
        </div>
      </div>
    </button>
  )
}

function CartPanel({
  cart, total, onUpdateQty, onClear, onPay,
}: {
  cart: ReturnType<typeof usePosStore.getState>['cart']
  total: number
  onUpdateQty: (id: string, qty: number) => void
  onClear: () => void
  onPay: () => void
}) {
  return (
    <>
      <div className="px-6 pt-7 pb-4 flex items-end justify-between">
        <div>
          <h2 className="text-[24px] font-bold tracking-tight text-ink">Current sale</h2>
          <p className="text-[14px] text-ink-secondary">{cart.length} {cart.length === 1 ? 'item' : 'items'}</p>
        </div>
        {cart.length > 0 && <button onClick={onClear} className="text-[14px] font-semibold text-danger pb-0.5">Clear</button>}
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-1">
        {cart.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center"><ShoppingBag size={24} /></div>
            <p className="mt-3 text-[15px] text-ink-secondary">Scan or tap a product to start a sale.</p>
          </div>
        )}
        {cart.map((item) => (
          <div key={item.productId} className="flex gap-3 items-center p-2 rounded-[16px] hover:bg-black/[0.03]">
            <ProductImage name={item.name} src={item.imageUrl} className="h-12 w-12 rounded-[12px] shrink-0" textClass="text-lg" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px] text-ink truncate">{item.name}</p>
              <p className="text-[12px] text-ink-secondary tabular-nums">{fmt(item.price)} × {item.quantity}</p>
            </div>
            <div className="inline-flex items-center rounded-full bg-black/[0.06]">
              <button onClick={() => onUpdateQty(item.productId, item.quantity - 1)} aria-label="Decrease" className="press h-7 w-7 flex items-center justify-center"><Minus size={13} /></button>
              <span className="w-6 text-center text-[14px] font-semibold tabular-nums">{item.quantity}</span>
              <button onClick={() => onUpdateQty(item.productId, item.quantity + 1)} aria-label="Increase" className="press h-7 w-7 flex items-center justify-center"><Plus size={13} /></button>
            </div>
            <p className="w-16 text-right text-[14px] font-bold tabular-nums">{fmt(item.lineTotal)}</p>
          </div>
        ))}
      </div>
      <div className="p-5 space-y-3 border-t border-black/5">
        <div className="flex justify-between items-baseline">
          <span className="text-[15px] font-semibold text-ink-secondary">Total</span>
          <span className="text-[28px] font-bold tabular-nums tracking-tight">{fmt(total)} <span className="text-[14px] text-ink-secondary">TZS</span></span>
        </div>
        <button
          onClick={onPay}
          disabled={cart.length === 0}
          className="press w-full h-14 rounded-[16px] bg-primary text-white text-[17px] font-bold disabled:opacity-40 shadow-soft"
        >
          Charge
        </button>
      </div>
    </>
  )
}
