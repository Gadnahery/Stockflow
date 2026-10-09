import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, X } from 'lucide-react'
import { db } from '../lib/db'
import type { StockMovement } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'

const REASONS = ['adjustment', 'damage', 'return', 'opening', 'transfer'] as const

export default function StockAdjustmentPage() {
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    productId: '',
    type: 'adjustment' as typeof REASONS[number],
    quantity: '',
    reason: '',
  })

  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), []) || []
  const movements = useLiveQuery(
    () => db.stockMovements.orderBy('createdAt').reverse().limit(100).toArray(),
    []
  ) || []

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
  )

  const save = async () => {
    const qty = parseInt(form.quantity)
    if (!form.productId || !qty) return

    const product = products.find((p) => p.id === form.productId)
    if (!product) return

    const user = (() => {
      try { return JSON.parse(sessionStorage.getItem('currentUser') || '{}') } catch { return {} }
    })()

    const previousStock = product.stock
    // For damage / adjustment negative means decrease
    const delta = form.type === 'damage' || form.type === 'transfer'
      ? -Math.abs(qty)
      : form.type === 'return' || form.type === 'opening'
        ? Math.abs(qty)
        : qty // free adjustment can be + or -

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

    setShowForm(false)
    setForm({ productId: '', type: 'adjustment', quantity: '', reason: '' })
  }

  return (
    <div className="h-full flex flex-col">
      <header className="page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Stock Adjustments</h1>
            <p className="text-sm text-ink-secondary">Manual stock changes & history</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adjust Stock</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-pad">
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-secondary">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">After</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium text-ink">{m.productName}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-secondary text-ink-secondary capitalize">
                      {m.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                    m.quantity >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{m.newStock}</td>
                  <td className="px-4 py-3 text-ink-secondary hidden md:table-cell">
                    {format(new Date(m.createdAt), 'dd MMM HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && (
            <p className="text-center text-ink-muted py-12">No stock movements yet</p>
          )}
        </div>
      </div>

      {showForm && (
        <div className="sheet-backdrop">
          <div className="sheet-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Adjust Stock</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-ink-muted"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Product *</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-full h-10 pl-9 pr-3 rounded-button bg-surface-secondary text-sm outline-none"
                  />
                </div>
                <select
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm"
                >
                  <option value="">Select product…</option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary outline-none text-sm"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r} className="capitalize">{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">
                  Quantity * {form.type === 'adjustment' && <span className="text-ink-muted">(use negative to decrease)</span>}
                </label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary outline-none text-sm tabular-nums"
                />
              </div>

              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Reason / Note</label>
                <input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary outline-none text-sm"
                />
              </div>

              <button onClick={save} className="w-full h-12 rounded-button bg-primary text-white font-medium">
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
