import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Package } from 'lucide-react'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { db, audit } from '../lib/db'
import type { StockMovement } from '../types'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { useUi } from '../store/uiStore'
import { fmt } from '../lib/util'

const REASONS = [
  { id: 'adjustment', label: 'Adjustment' },
  { id: 'damage', label: 'Damage' },
  { id: 'return', label: 'Return in' },
  { id: 'opening', label: 'Opening stock' },
  { id: 'transfer', label: 'Transfer out' },
] as const

type ReasonId = (typeof REASONS)[number]['id']

export default function StockAdjustmentPage() {
  const toast = useUi((s) => s.toast)
  const [showForm, setShowForm] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [form, setForm] = useState({
    productId: '',
    type: 'adjustment' as ReasonId,
    quantity: '',
    reason: '',
  })

  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), [])
  const movements = useLiveQuery(
    () => db.stockMovements.orderBy('createdAt').reverse().limit(100).toArray(),
    [],
  )
  const loading = movements === undefined

  const filteredProducts = useMemo(() => {
    const list = products || []
    const q = productQuery.trim().toLowerCase()
    if (!q) return list.slice(0, 40)
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').includes(q),
    ).slice(0, 40)
  }, [products, productQuery])

  const selected = (products || []).find((p) => p.id === form.productId)

  const save = async () => {
    const qty = parseInt(form.quantity, 10)
    if (!form.productId || !qty) {
      toast('Select a product and quantity', 'error')
      return
    }
    const product = (products || []).find((p) => p.id === form.productId)
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

  const list = movements || []

  return (
    <Screen
      title="Stock"
      subtitle="Adjustments and movement history"
      action={
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="press h-9 px-3.5 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5"
        >
          <Plus size={16} /> Adjust
        </button>
      }
    >
      <div className="space-y-4 md:max-w-2xl pb-6">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-[16px] bg-white shadow-card skeleton" />
            ))}
          </div>
        )}

        {!loading && list.length === 0 && (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-12 text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#F3E8FF] text-[#AF52DE] flex items-center justify-center">
              <Package size={26} />
            </div>
            <p className="text-[16px] font-semibold">No movements yet</p>
            <p className="text-[14px] text-ink-secondary mt-1 mb-4">Adjust stock for damage, counts, or opening balances.</p>
            <button type="button" onClick={() => setShowForm(true)} className="press h-11 px-5 rounded-[14px] bg-primary text-white font-semibold">
              Adjust stock
            </button>
          </div>
        )}

        {!loading && list.length > 0 && (
          <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
            {list.map((m, i) => (
              <div key={m.id} className={`px-4 py-3.5 ${i < list.length - 1 ? 'border-b border-border' : ''}`}>
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
                    <p className={`text-[15px] font-semibold tabular-nums ${m.quantity >= 0 ? 'text-success' : 'text-danger'}`}>
                      {m.quantity >= 0 ? '+' : ''}{fmt(m.quantity)}
                    </p>
                    <p className="text-[12px] text-ink-muted tabular-nums">→ {fmt(m.newStock)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Adjust stock"
        footer={
          <button type="button" onClick={() => void save()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold">
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
                Current stock: <strong className="tabular-nums">{fmt(selected.stock)}</strong>
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
    </Screen>
  )
}
