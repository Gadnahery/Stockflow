import { useEffect, useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, ShoppingBag, Wifi, WifiOff, Plus, Minus, Trash2, ScanLine, ChevronRight, Check, PauseCircle, X as XIcon } from 'lucide-react'
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
import { usePermission } from '../hooks/usePermission'
import { useI18n } from '../i18n/I18nContext'
import { getBranchId } from '../lib/supabase'
import ActiveBranchChip from '../components/ActiveBranchChip'
import { featuresFor } from '../lib/industry'
import { format } from 'date-fns'

const METHOD_IDS = ['cash', 'mobile', 'card', 'bank', 'credit'] as const
const METHOD_KEYS = {
  cash: 'pos.cash',
  mobile: 'pos.mobile',
  card: 'pos.card',
  bank: 'pos.bank',
  credit: 'pos.credit',
} as const

export default function PosPage() {
  const toast = useUi((s) => s.toast)
  const { t } = useI18n()
  const settingsRow = useLiveQuery(() => db.settings.get('main'), [])
  const industryFeats = featuresFor(settingsRow?.industryType)
  const onScroll = useTabCompact()
  const {
    cart, searchQuery, setSearchQuery, addToCart, updateQuantity, removeFromCart, clearCart,
    isOnline, pendingSyncCount, completeSale, setCustomer, selectedCustomerName, applyCartDiscount,
    held, holdCart, resumeHeld, deleteHeld, catalogTick,
  } = usePosStore()
  const { can } = usePermission()

  const [showPay, setShowPay] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [saleNote, setSaleNote] = useState('')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [payMethod, setPayMethod] = useState<(typeof METHOD_IDS)[number]>('cash')
  const [discountInput, setDiscountInput] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [paying, setPaying] = useState(false)
  const [lines, setLines] = useState<Payment[]>([])
  const [discMode, setDiscMode] = useState<'amount' | 'percent'>('amount')
  const [showHeld, setShowHeld] = useState(false)

  const branchId = getBranchId()
  const productsQ = useLiveQuery(
    () =>
      db.products
        .filter((p) => {
          if (!p.active) return false
          // Per-branch catalog: this branch, or shared products (no branchId)
          if (!branchId) return true
          return !p.branchId || p.branchId === branchId
        })
        .toArray(),
    [catalogTick, branchId],
  )
  const products = useMemo(() => productsQ ?? [], [productsQ])
  const loading = productsQ === undefined
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []) || []
  const openShift = useLiveQuery(() => db.cashSessions.filter((s) => s.status === 'open').first(), [])
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

  const paidLines = lines.reduce((t, l) => t + l.amount, 0)
  const remaining = Math.max(0, Math.round((payTotal - paidLines) * 100) / 100)
  const typedCash = parseFloat(cashReceived)
  const buildFinal = (): Payment[] => {
    if (remaining <= 0.01) return lines
    const typed = typedCash > 0 ? typedCash : remaining
    const amount = payMethod === 'cash' ? typed : Math.min(typed, remaining)
    return [...lines, { method: payMethod, amount }]
  }
  const finalPaid = buildFinal().reduce((t, l) => t + l.amount, 0)
  const canCharge = finalPaid >= payTotal - 0.01

  useEffect(() => {
    if (cart.length === 0) setLines([])
  }, [cart.length])

  // Desktop shortcuts: F2 search, F3 hold, F4 pay, Esc close sheets
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus()
      }
      if (e.key === 'F3' && cart.length > 0) {
        e.preventDefault()
        if (holdCart()) {
          setShowPay(false)
          setLines([])
          toast(t('pos.cartHeld'), 'info')
        }
      }
      if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault()
        {
          if (industryFeats.ageCheck) {
            toast(t('pos.ageCheck') || 'Confirm customer is of legal age before completing this sale', 'info')
          }
          setShowPay(true)
        }
      }
      if (e.key === 'Escape') {
        setShowPay(false)
        setShowHeld(false)
        setScanning(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cart.length, holdCart, toast])


  const add = (p: Product, sellAs: 'unit' | 'pack' = 'unit') => {
    if (p.stock <= 0) {
      toast(`${p.name} ${t('pos.outOfStock')}`, 'error')
      return
    }
    const inCart = qtyById.get(p.id) ?? 0
    if (inCart >= p.stock) {
      toast(t('pos.onlyStock').replace('{n}', fmt(p.stock)).replace('{name}', p.name), 'error')
      return
    }
    addToCart(p, 1, sellAs)
    haptic(10)
  }

  const handleScan = (raw: string) => {
    const code = raw.trim()
    const p = products.find((x) => x.barcode === code || x.sku.toLowerCase() === code.toLowerCase())
    if (!p) {
      toast(t('pos.noProduct').replace('{code}', code), 'error')
      return
    }
    add(p)
    toast(`${p.name} ${t('pos.added')}`, 'success')
  }

  // Hardware (keyboard-wedge) USB barcode scanners
  useEffect(() => {
    let buffer = ''
    let timeout: ReturnType<typeof setTimeout>
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      // Allow scanning even from search field; skip textarea/select only
      if (tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault()
          const code = buffer
          buffer = ''
          const product = products.find(
            (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase(),
          )
          if (product) {
            if (product.stock <= 0) {
              toast(`${product.name} ${t('pos.outOfStock')}`, 'error')
            } else {
              addToCart(product)
              setSearchQuery('')
              haptic(10)
              toast(product.name, 'success')
            }
          } else {
            toast(`No product for ${code}`, 'error')
          }
        }
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key
        clearTimeout(timeout)
        timeout = setTimeout(() => { buffer = '' }, 80)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [products, addToCart, setSearchQuery, toast])

  const handlePay = async () => {
    if (paying) return
    const payments = buildFinal()
    setPaying(true)
    try {
      const sale = await completeSale(payments, saleNote)
      haptic(30)
      setLastSale(sale)
      setShowPay(false)
      setCashReceived('')
      setSaleNote('')
      setDiscountInput('')
      setPayMethod('cash')
      setCustomerQuery('')
      setLines([])
      toast(t('pos.saleDone'), 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setPaying(false)
    }
  }

  const addSplit = () => {
    if (!(typedCash > 0)) return toast('Enter the amount for this payment first', 'error')
    if (typedCash >= remaining - 0.01 && payMethod !== 'cash') return toast('That covers the balance — tap Charge', 'info')
    if (payMethod === 'cash' && typedCash >= remaining - 0.01) return toast('That covers the balance — tap Charge', 'info')
    setLines((l) => [...l, { method: payMethod, amount: typedCash }])
    setCashReceived('')
  }

  const doHold = () => {
    if (holdCart()) { setShowPay(false); setLines([]); toast(t('pos.cartHeld'), 'info') }
  }

  const applyDiscount = () => {
    const v = parseFloat(discountInput) || 0
    const gross = subtotal + cartDiscount
    const d = discMode === 'percent' ? Math.min(100, v) * gross / 100 : Math.min(v, gross)
    if (d > 0) applyCartDiscount(Math.round(d))
  }

  const filteredCustomers = customerQuery.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerQuery.toLowerCase()) || (c.phone && c.phone.includes(customerQuery))
      ).slice(0, 5)
    : []

  const quickCash = Array.from(
    new Set([remaining, ...[1000, 5000, 10000, 20000, 50000].map((s) => Math.ceil(remaining / s) * s)])
  ).filter((v) => v >= remaining && v > 0).slice(0, 4)

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Products */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto" onScroll={onScroll}>
        <header className="page-header !pb-3">
          <div className="flex items-center justify-between">
            <h1 className="page-title">StockFlow</h1>
            <div className="flex items-center gap-2">
              <ActiveBranchChip />
              <span className={`flex items-center gap-1.5 text-[12px] font-semibold px-2.5 h-7 rounded-full ${isOnline ? 'bg-emerald-500/10 text-success' : 'bg-amber-500/15 text-warning'}`}>
                {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {held.length > 0 && (
                <button onClick={() => setShowHeld(true)} className="press text-[12px] font-semibold bg-amber-100 text-warning px-2.5 h-7 inline-flex items-center rounded-full tabular-nums">Held {held.length}</button>
              )}
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
                placeholder={t('pos.search')}
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

        {openShift === null && (
          <div className="mx-4 md:mx-6 mt-3 rounded-[14px] bg-amber-50 text-warning px-4 py-2.5 text-[13px] font-medium flex items-center justify-between gap-2">
            <span>No open cash shift — open a till before taking cash (Shifts).</span>
          </div>
        )}
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
                <ProductCard key={product.id} product={product} qty={qtyById.get(product.id) ?? 0} onAdd={(mode) => add(product, mode)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart (desktop) */}
      <aside className="hidden md:flex w-[360px] lg:w-[400px] xl:w-[420px] flex-col glass border-l border-black/5 shrink-0">
        <CartPanel
          cart={cart}
          total={payTotal}
          onUpdateQty={updateQuantity}
          onClear={clearCart}
          onPay={() => setShowPay(true)}
          onHold={doHold}
          heldCount={held.length}
          onShowHeld={() => setShowHeld(true)}
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
              disabled={paying || !canCharge}
              className="press w-full h-14 rounded-[16px] bg-primary text-white text-[17px] font-bold disabled:opacity-40 shadow-soft"
            >
              {paying ? t('pos.completing') : `${t('pos.charge')} ${fmt(payTotal)} TZS`}
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
                  <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder={t('pos.noCustomer')} className="field" />
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
            {can('APPLY_DISCOUNT') && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-semibold text-ink-secondary">Discount</label>
                  <div className="inline-flex p-0.5 rounded-full bg-black/[0.06] text-[12px] font-semibold">
                    {(['amount', 'percent'] as const).map((m2) => (
                      <button key={m2} onClick={() => setDiscMode(m2)} className={`px-3 h-7 rounded-full ${discMode === m2 ? 'bg-white shadow-soft text-ink' : 'text-ink-secondary'}`}>{m2 === 'amount' ? 'TZS' : '%'}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input type="number" inputMode="decimal" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder={discMode === 'percent' ? '10' : '0'} className="field tabular-nums flex-1" />
                  <button onClick={applyDiscount} className="press h-[46px] px-5 rounded-[14px] bg-black/[0.06] text-[15px] font-semibold">Apply</button>
                </div>
              </div>
            )}

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

            {/* Optional note */}
            <div className="mt-4">
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Note (optional)</label>
              <input
                className="field"
                value={saleNote}
                onChange={(e) => setSaleNote(e.target.value)}
                placeholder={t('pos.note')}
              />
            </div>

            {/* Payment method — iOS segmented control */}
            <div className="mt-5">
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">{t('pos.pay')}</label>
              <div className="grid grid-cols-5 p-1 rounded-[14px] bg-black/[0.06]">
                {METHOD_IDS.map((id) => (
                  <button
                    key={id}
                    onClick={() => setPayMethod(id)}
                    className={`h-10 rounded-[11px] text-[13px] font-semibold transition-all duration-200 ${
                      payMethod === id ? 'bg-white text-ink shadow-soft' : 'text-ink-secondary'
                    }`}
                  >
                    {t(METHOD_KEYS[id])}
                  </button>
                ))}
              </div>
            </div>

            {lines.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-2 h-10 px-3 rounded-[12px] bg-emerald-50 text-[14px]">
                    <Check size={15} className="text-success" strokeWidth={3} />
                    <span className="capitalize font-semibold flex-1">{l.method}</span>
                    <span className="tabular-nums font-bold">{fmt(l.amount)}</span>
                    <button onClick={() => setLines((x) => x.filter((_, j) => j !== i))} aria-label="Remove payment" className="text-ink-muted"><XIcon size={15} /></button>
                  </li>
                ))}
                <li className="flex justify-between text-[15px] font-bold px-1 pt-1"><span>Remaining</span><span className="tabular-nums">{fmt(remaining)} TZS</span></li>
              </ul>
            )}

            <div className="mt-4">
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
                {payMethod === 'cash' ? 'Cash received' : payMethod === 'credit' ? 'Put on customer account' : 'Amount'}
              </label>
              <input type="number" inputMode="decimal" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder={String(remaining)} className="field !h-14 text-[22px] font-semibold tabular-nums" />
              {payMethod === 'cash' && (
                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {quickCash.map((v) => (
                    <button key={v} type="button" onClick={() => setCashReceived(String(v))} className="press shrink-0 h-9 px-4 rounded-full bg-primary/10 text-primary text-[14px] font-semibold tabular-nums">
                      {v === remaining ? 'Exact' : fmt(v)}
                    </button>
                  ))}
                </div>
              )}
              {/* Touch numpad for cash / amount */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === '⌫') setCashReceived((s) => s.slice(0, -1))
                      else if (k === '.' && cashReceived.includes('.')) return
                      else setCashReceived((s) => (s === '0' && k !== '.' ? k : s + k))
                    }}
                    className="press h-12 rounded-[14px] bg-black/[0.05] text-[18px] font-semibold tabular-nums"
                  >
                    {k}
                  </button>
                ))}
              </div>
              {payMethod === 'credit' && !selectedCustomerName && <p className="mt-2 text-[13px] text-warning font-medium">Choose a customer above to sell on credit.</p>}
              {payMethod === 'cash' && typedCash > 0 && (
                typedCash >= remaining ? (
                  <p className="mt-3 flex items-center gap-1.5 text-[15px] font-semibold text-success"><Check size={16} strokeWidth={3} /> Change: {fmt(typedCash - remaining)} TZS</p>
                ) : (
                  <p className="mt-3 text-[14px] font-medium text-danger">{fmt(remaining - typedCash)} TZS still to pay</p>
                )
              )}
              {typedCash > 0 && typedCash < remaining && (
                <button onClick={addSplit} className="press mt-3 h-10 px-4 rounded-full bg-black/[0.06] text-[14px] font-semibold">+ Add as split payment</button>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={doHold} className="press flex-1 h-11 rounded-[14px] bg-black/[0.06] text-[15px] font-semibold flex items-center justify-center gap-1.5"><PauseCircle size={17} /> Hold</button>
              <button onClick={clearCart} className="press flex-1 h-11 rounded-[14px] bg-red-50 text-danger text-[15px] font-semibold">Clear cart</button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={showHeld} onClose={() => setShowHeld(false)} title="Held carts">
        {held.length === 0 ? <p className="py-8 text-center text-ink-secondary">Nothing on hold.</p> : (
          <ul className="divide-y divide-border">
            {held.map((h) => (
              <li key={h.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px]">{h.items.reduce((t, i) => t + i.quantity, 0)} items · {fmt(h.items.reduce((t, i) => t + i.lineTotal, 0))} TZS</p>
                  <p className="text-[13px] text-ink-muted truncate">{h.customerName ? `${h.customerName} · ` : ''}{format(new Date(h.createdAt), 'HH:mm')}</p>
                </div>
                <button onClick={() => { if (resumeHeld(h.id)) { setShowHeld(false); setShowPay(true) } else toast('Hold or clear the current cart first', 'error') }} className="press h-9 px-4 rounded-full bg-primary text-white text-[14px] font-semibold">Resume</button>
                <button onClick={() => deleteHeld(h.id)} aria-label="Delete held cart" className="press h-9 w-9 rounded-full bg-red-50 text-danger flex items-center justify-center"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
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

function ProductCard({ product, qty, onAdd }: { product: Product; qty: number; onAdd: (mode?: 'unit' | 'pack') => void }) {
  const out = product.stock <= 0
  const low = !out && product.stock <= (product.minStock ?? 5)
  const hasPack = (product.packQty || 0) > 1
  return (
    <div className="group relative flex flex-col bg-white rounded-[22px] shadow-card p-2.5 text-left overflow-hidden">
      <button
        type="button"
        onClick={() => onAdd('unit')}
        disabled={out}
        className="press flex flex-col flex-1 text-left disabled:opacity-50"
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
            <span className="font-bold text-ink tabular-nums text-[17px] tracking-tight">
              {fmt(product.price)}
              {hasPack ? <span className="text-[11px] font-semibold text-ink-muted ml-1">reja</span> : null}
            </span>
            {!out && !low && <span className="text-[12px] text-ink-muted tabular-nums">{fmt(product.stock)} left</span>}
          </div>
        </div>
      </button>
      {hasPack && !out && (
        <button
          type="button"
          onClick={() => onAdd('pack')}
          className="press mt-1 h-8 rounded-full bg-primary/10 text-primary text-[12px] font-bold"
        >
          Jumla: {product.packName || 'Pack'} ×{product.packQty}
          {product.packPrice != null ? ` · ${fmt(product.packPrice)}` : ''}
        </button>
      )}
    </div>
  )
}

function CartPanel({
  cart, total, onUpdateQty, onClear, onPay, onHold, heldCount, onShowHeld,
}: {
  cart: ReturnType<typeof usePosStore.getState>['cart']
  total: number
  onUpdateQty: (id: string, qty: number) => void
  onClear: () => void
  onPay: () => void
  onHold?: () => void
  heldCount?: number
  onShowHeld?: () => void
}) {
  const { t } = useI18n()
  return (
    <>
      <div className="px-6 pt-7 pb-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[24px] font-bold tracking-tight text-ink">Current sale</h2>
          <p className="text-[14px] text-ink-secondary">
            {cart.length} {cart.length === 1 ? 'item' : 'items'}
            {(heldCount ?? 0) > 0 && (
              <button type="button" onClick={onShowHeld} className="ml-2 text-primary font-semibold">
                · {heldCount} held
              </button>
            )}
          </p>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            {onHold && (
              <button type="button" onClick={onHold} className="text-[14px] font-semibold text-ink-secondary">Hold</button>
            )}
            <button type="button" onClick={onClear} className="text-[14px] font-semibold text-danger">Clear</button>
          </div>
        )}
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
          {t('pos.charge')}
        </button>
      </div>
    </>
  )
}
