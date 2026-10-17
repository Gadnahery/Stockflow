import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Package, AlertTriangle, TrendingDown, Search, Truck } from 'lucide-react'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { db, audit } from '../lib/db'
import type { StockMovement, Product } from '../types'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { useUi } from '../store/uiStore'
import { fmt, fmtMoney } from '../lib/util'
import { transferStock, locationLabel, dualLocationEnabled } from '../lib/locations'
import { assertCanWrite } from '../lib/entitlement'
import { useI18n } from '../i18n/I18nContext'

const REASONS = [
  { id: 'adjustment', label: 'Count / adjustment' },
  { id: 'damage', label: 'Damage' },
  { id: 'return', label: 'Return in' },
  { id: 'opening', label: 'Opening stock' },
  { id: 'transfer', label: 'Transfer out' },
] as const

type ReasonId = (typeof REASONS)[number]['id']
type Tab = 'overview' | 'low' | 'movements'

export default function StockAdjustmentPage() {
  const { t } = useI18n()

  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [showForm, setShowForm] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [xfer, setXfer] = useState({ productId: '', qty: '', direction: 'store_to_shop' as 'store_to_shop' | 'shop_to_store' })
  useEffect(() => { void dualLocationEnabled() }, [])
  const [productQuery, setProductQuery] = useState('')
  const [movQuery, setMovQuery] = useState('')
  const [form, setForm] = useState({
    productId: '',
    type: 'adjustment' as ReasonId,
    quantity: '',
    reason: '',
  })

  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), [])
  const movements = useLiveQuery(
    () => db.stockMovements.orderBy('createdAt').reverse().limit(200).toArray(),
    [],
  )
  const loading = products === undefined || movements === undefined
  const list = products || []
  const movs = movements || []

  const stats = useMemo(() => {
    const skus = list.length
    const valueCost = list.reduce((t, p) => t + p.stock * (p.cost || 0), 0)
    const valueRetail = list.reduce((t, p) => t + p.stock * (p.price || 0), 0)
    const out = list.filter((p) => p.stock <= 0)
    const low = list.filter((p) => p.stock > 0 && p.stock <= (p.minStock ?? 0))
    const units = list.reduce((t, p) => t + Math.max(0, p.stock), 0)
    return { skus, valueCost, valueRetail, out, low, units }
  }, [list])

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return list.slice(0, 50)
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode || '').includes(q),
      )
      .slice(0, 50)
  }, [list, productQuery])

  const filteredMovs = useMemo(() => {
    const q = movQuery.trim().toLowerCase()
    if (!q) return movs
    return movs.filter(
      (m) =>
        m.productName.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        (m.reason || '').toLowerCase().includes(q),
    )
  }, [movs, movQuery])

  const selected = list.find((p) => p.id === form.productId)

  const openAdjust = (p?: Product) => {
    if (p) {
      setForm({ productId: p.id, type: 'adjustment', quantity: '', reason: '' })
      setProductQuery(p.name)
    } else {
      setForm({ productId: '', type: 'adjustment', quantity: '', reason: '' })
      setProductQuery('')
    }
    setShowForm(true)
  }

  const save = async () => {
    assertCanWrite()
    const qty = parseInt(form.quantity, 10)
    if (!form.productId || !qty) {
      toast('Select a product and quantity', 'error')
      return
    }
    const product = list.find((p) => p.id === form.productId)
    if (!product) return

    const user = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('currentUser') || '{}') as { id?: string }
      } catch {
        return {}
      }
    })()

    const previousStock = product.stock
    const delta =
      form.type === 'damage' || form.type === 'transfer'
        ? -Math.abs(qty)
        : form.type === 'return' || form.type === 'opening'
          ? Math.abs(qty)
          : qty

    const newStock = Math.max(0, previousStock + delta)
    const now = new Date().toISOString()

    const movement: StockMovement = {
      id: uuidv4(),
      productId: product.id,
      productName: product.name,
      type: form.type,
      quantity: delta,
      previousStock,
      newStock,
      reason: form.reason.trim() || undefined,
      userId: user.id,
      createdAt: now,
      synced: false,
    }

    await db.transaction('rw', db.products, db.stockMovements, db.outbox, async () => {
      await db.products.update(product.id, { stock: newStock, updatedAt: now })
      await db.stockMovements.add(movement)
      await db.outbox.add({
        id: uuidv4(),
        type: 'stock_movement',
        payload: movement,
        createdAt: now,
        retries: 0,
      })
      const updated = { ...product, stock: newStock, updatedAt: now }
      await db.outbox.add({
        id: uuidv4(),
        type: 'product_upsert',
        payload: updated,
        createdAt: now,
        retries: 0,
      })
    })
    await audit('STOCK_ADJUST', 'product', product.id, {
      before: { stock: previousStock },
      after: { stock: newStock },
      reason: `${form.type}${form.reason ? ': ' + form.reason : ''} — ${product.name}`,
    })

    toast('Stock updated', 'success')
    setShowForm(false)
    setForm({ productId: '', type: 'adjustment', quantity: '', reason: '' })
    setProductQuery('')
  }


  const runTransfer = async () => {
    assertCanWrite()
    const qty = parseFloat(xfer.qty)
    if (!xfer.productId || !qty || qty <= 0) {
      toast('Select a product and quantity', 'error')
      return
    }
    try {
      await transferStock({
        productId: xfer.productId,
        quantity: qty,
        direction: xfer.direction,
      })
      await audit('STOCK_TRANSFER', 'product', xfer.productId, {
        after: { qty, direction: xfer.direction },
      })
      toast(xfer.direction === 'store_to_shop' ? 'Moved to shop floor' : 'Moved to store', 'success')
      setShowTransfer(false)
      setXfer({ productId: '', qty: '', direction: 'store_to_shop' })
    } catch (e) {
      toast((e as Error).message || 'Transfer failed', 'error')
    }
  }

  return (
    <Screen
      title="Inventory"
      subtitle={`${stats.skus} active SKUs · ${fmt(stats.units)} units`}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTransfer(true)}
            className="press h-9 px-3 rounded-full bg-black/[0.06] text-ink text-[13px] font-semibold"
          >
            Store ↔ Shop
          </button>
          <button
            type="button"
            onClick={() => openAdjust()}
            className="press h-9 px-3.5 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5"
          >
            <Plus size={16} /> Adjust
          </button>
        </div>
      }
    >
      <div className="space-y-4 md:max-w-3xl pb-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[18px] bg-white shadow-card p-4">
            <p className="text-[12px] font-medium text-ink-muted">{t('stock.valueCost')}</p>
            <p className="text-[18px] font-bold tabular-nums mt-0.5">{fmtMoney(stats.valueCost)}</p>
          </div>
          <div className="rounded-[18px] bg-white shadow-card p-4">
            <p className="text-[12px] font-medium text-ink-muted">{t('stock.valueRetail')}</p>
            <p className="text-[18px] font-bold tabular-nums mt-0.5">{fmtMoney(stats.valueRetail)}</p>
          </div>
          <button
            type="button"
            onClick={() => setTab('low')}
            className="rounded-[18px] bg-white shadow-card p-4 text-left"
          >
            <p className="text-[12px] font-medium text-warning flex items-center gap-1">
              <AlertTriangle size={13} /> Low stock
            </p>
            <p className="text-[22px] font-bold tabular-nums mt-0.5 text-warning">{stats.low.length}</p>
          </button>
          <button
            type="button"
            onClick={() => setTab('low')}
            className="rounded-[18px] bg-white shadow-card p-4 text-left"
          >
            <p className="text-[12px] font-medium text-danger flex items-center gap-1">
              <TrendingDown size={13} /> Out of stock
            </p>
            <p className="text-[22px] font-bold tabular-nums mt-0.5 text-danger">{stats.out.length}</p>
          </button>
        </div>

        <Link
          to="/suppliers"
          className="flex items-center gap-3 rounded-[18px] bg-white shadow-card px-4 py-3.5"
        >
          <span className="h-10 w-10 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center">
            <Truck size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold">{t('stock.receiveGrn')}</span>
            <span className="block text-[13px] text-ink-secondary">{t('stock.receiveHint')}</span>
          </span>
        </Link>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-full bg-black/[0.05] w-fit">
          {(
            [
              ['overview', 'Overview'],
              ['low', 'Alerts'],
              ['movements', 'Ledger'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`press h-9 px-4 rounded-full text-[13px] font-semibold ${
                tab === id ? 'bg-white text-ink shadow-card' : 'text-ink-secondary'
              }`}
            >
              {label}
              {id === 'low' && stats.low.length + stats.out.length > 0 && (
                <span className="ml-1.5 text-[11px] tabular-nums text-warning">
                  {stats.low.length + stats.out.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-[16px] bg-white shadow-card skeleton" />
            ))}
          </div>
        )}

        {/* Overview — top low items preview */}
        {!loading && tab === 'overview' && (
          <div className="space-y-3">
            {(stats.low.length > 0 || stats.out.length > 0) ? (
              <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-[14px] font-semibold">{t('stock.needsAttention')}</p>
                  <button type="button" onClick={() => setTab('low')} className="text-[13px] font-semibold text-primary">
                    See all
                  </button>
                </div>
                {[...stats.out, ...stats.low].slice(0, 6).map((p, i, arr) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openAdjust(p)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold truncate">{p.name}</span>
                      <span className="block text-[12px] text-ink-muted">
                        Min {fmt(p.minStock ?? 0)} · SKU {p.sku}
                      </span>
                    </span>
                    <span
                      className={`text-[14px] font-bold tabular-nums ${
                        p.stock <= 0 ? 'text-danger' : 'text-warning'
                      }`}
                    >
                      {fmt(p.stock)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] bg-white shadow-card px-6 py-10 text-center">
                <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-emerald-50 text-success flex items-center justify-center">
                  <Package size={26} />
                </div>
                <p className="text-[16px] font-semibold">{t('stock.healthy')}</p>
                <p className="text-[14px] text-ink-secondary mt-1">{t('stock.noBelowMin')}</p>
              </div>
            )}
          </div>
        )}

        {/* Alerts */}
        {!loading && tab === 'low' && (
          <div className="space-y-3">
            {(stats.out.length > 0 || stats.low.length > 0) && (
              <button
                type="button"
                className="press w-full h-11 rounded-[14px] bg-primary text-white font-semibold text-[14px]"
                onClick={() => {
                  const ids = [...stats.out, ...stats.low].map((p) => p.id).join(',')
                  try { sessionStorage.setItem('sf_po_low_stock', ids) } catch { /* ignore */ }
                  navigate('/suppliers?tab=purchases&from=lowstock')
                  toast('Open New PO — low-stock products are ready to add', 'success')
                }}
              >
                Create purchase order from low stock
              </button>
            )}
            {stats.out.length === 0 && stats.low.length === 0 && (
              <p className="text-[14px] text-ink-muted text-center py-8">{t('stock.nothingBelow')}</p>
            )}
            {stats.out.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-danger mb-2 px-1">{t('stock.outOfStock')}</p>
                <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
                  {stats.out.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openAdjust(p)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                        i < stats.out.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold truncate">{p.name}</span>
                        <span className="block text-[12px] text-ink-muted">
                          Cost {fmtMoney(p.cost)} · Sell {fmtMoney(p.price)}
                        </span>
                      </span>
                      <span className="text-[13px] font-semibold text-primary">Restock</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {stats.low.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-warning mb-2 px-1">{t('stock.belowMin')}</p>
                <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
                  {stats.low.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openAdjust(p)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                        i < stats.low.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold truncate">{p.name}</span>
                        <span className="block text-[12px] text-ink-muted">
                          {fmt(p.stock)} left · min {fmt(p.minStock ?? 0)}
                        </span>
                      </span>
                      <span className="text-[14px] font-bold tabular-nums text-warning">{fmt(p.stock)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ledger */}
        {!loading && tab === 'movements' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                className="field w-full !pl-10"
                placeholder="Search movements…"
                value={movQuery}
                onChange={(e) => setMovQuery(e.target.value)}
              />
            </div>
            {filteredMovs.length === 0 ? (
              <div className="rounded-[22px] bg-white shadow-card px-6 py-10 text-center">
                <p className="text-[16px] font-semibold">{t('stock.noMovements')}</p>
                <p className="text-[14px] text-ink-secondary mt-1">Sales, purchases, and adjustments appear here.</p>
              </div>
            ) : (
              <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
                {filteredMovs.map((m, i) => (
                  <div
                    key={m.id}
                    className={`px-4 py-3.5 ${i < filteredMovs.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold truncate">{m.productName}</p>
                        <p className="text-[13px] text-ink-secondary capitalize">
                          {m.type}
                          {m.reason ? ` · ${m.reason}` : ''}
                          {' · '}
                          {format(new Date(m.createdAt), 'dd MMM HH:mm')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-[15px] font-semibold tabular-nums ${
                            m.quantity >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {m.quantity >= 0 ? '+' : ''}
                          {fmt(m.quantity)}
                        </p>
                        <p className="text-[12px] text-ink-muted tabular-nums">→ {fmt(m.newStock)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Adjust stock"
        footer={
          <button
            type="button"
            onClick={() => void save()}
            className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold"
          >
            Save movement
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="auth-label">Product</label>
            <input
              className="field w-full mb-2"
              placeholder="Search name, SKU, barcode…"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto rounded-[14px] border border-border divide-y divide-border">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setForm({ ...form, productId: p.id })
                    setProductQuery(p.name)
                  }}
                  className={`w-full text-left px-3 py-2.5 text-[14px] ${
                    form.productId === p.id ? 'bg-primary/10 text-primary font-semibold' : 'text-ink'
                  }`}
                >
                  {p.name}
                  <span className="text-ink-muted font-normal"> · {fmt(p.stock)} in stock</span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="px-3 py-3 text-[13px] text-ink-muted">No products match</p>
              )}
            </div>
            {selected && (
              <p className="text-[13px] text-ink-secondary mt-2">
                Current: <strong className="tabular-nums">{fmt(selected.stock)}</strong>
                {selected.minStock != null && (
                  <> · Min <strong className="tabular-nums">{fmt(selected.minStock)}</strong></>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="auth-label">Reason</label>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm({ ...form, type: r.id })}
                  className={`press h-9 px-3 rounded-full text-[13px] font-semibold ${
                    form.type === r.id ? 'bg-primary text-white' : 'bg-black/[0.06] text-ink-secondary'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="auth-label">
              Quantity {form.type === 'adjustment' ? '(use − for decrease)' : ''}
            </label>
            <input
              className="field w-full"
              inputMode="numeric"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder={form.type === 'adjustment' ? 'e.g. 5 or -3' : 'e.g. 5'}
            />
          </div>

          <div>
            <label className="auth-label">Note</label>
            <input
              className="field w-full"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Optional details"
            />
          </div>
        </div>
      </Sheet>

      <Sheet open={showTransfer} onClose={() => setShowTransfer(false)} title="Store ↔ Shop">
        <div className="space-y-4 pb-6">
          <p className="text-[13px] text-ink-secondary">
            Move stock between back-room store and shop floor. POS only sells from the shop.
          </p>
          <div>
            <label className="auth-label">Product</label>
            <select
              className="field w-full"
              value={xfer.productId}
              onChange={(e) => setXfer({ ...xfer, productId: e.target.value })}
            >
              <option value="">Select…</option>
              {(list || products || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {locationLabel(p.stock, p.storeStock ?? 0)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="auth-label">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`press rounded-[12px] px-3 py-2.5 text-[13px] font-semibold border ${xfer.direction === 'store_to_shop' ? 'border-primary bg-primary/10' : 'border-border'}`}
                onClick={() => setXfer({ ...xfer, direction: 'store_to_shop' })}
              >
                Store → Shop
              </button>
              <button
                type="button"
                className={`press rounded-[12px] px-3 py-2.5 text-[13px] font-semibold border ${xfer.direction === 'shop_to_store' ? 'border-primary bg-primary/10' : 'border-border'}`}
                onClick={() => setXfer({ ...xfer, direction: 'shop_to_store' })}
              >
                Shop → Store
              </button>
            </div>
          </div>
          <div>
            <label className="auth-label">Quantity</label>
            <input
              className="field w-full tabular-nums"
              type="number"
              inputMode="decimal"
              value={xfer.qty}
              onChange={(e) => setXfer({ ...xfer, qty: e.target.value })}
              placeholder="0"
            />
          </div>
          <button type="button" className="press w-full h-12 rounded-full bg-primary text-white font-semibold" onClick={() => void runTransfer()}>
            Transfer
          </button>
        </div>
      </Sheet>
    </Screen>
  )
}
