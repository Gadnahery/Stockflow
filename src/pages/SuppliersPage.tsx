import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, Truck, X, PackagePlus, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import type { Supplier, PurchaseOrder } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'

const emptySupplier = { name: '', phone: '', email: '', address: '', notes: '' }

export default function SuppliersPage() {
  const [tab, setTab] = useState<'suppliers' | 'purchases'>('suppliers')
  const [query, setQuery] = useState('')
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptySupplier)

  // Purchase form state
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('')
  const [purchaseItems, setPurchaseItems] = useState<{ productId: string; name: string; quantity: string; cost: string }[]>([])
  const [purchaseNote, setPurchaseNote] = useState('')

  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), []) || []
  const purchases = useLiveQuery(() => db.purchases.orderBy('createdAt').reverse().toArray(), []) || []
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), []) || []

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.phone && s.phone.includes(query))
  )

  const openCreateSupplier = () => {
    setEditing(null)
    setForm(emptySupplier)
    setShowSupplierForm(true)
  }

  const openEditSupplier = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || '',
    })
    setShowSupplierForm(true)
  }

  const handleDeleteSupplier = async () => {
    if (!editing) return
    if (!confirm(`Delete supplier "${editing.name}"?`)) return
    await db.suppliers.delete(editing.id)
    setShowSupplierForm(false)
  }

  const saveSupplier = async () => {
    if (!form.name.trim()) return
    const now = new Date().toISOString()
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      updatedAt: now,
    }
    if (editing) {
      await db.suppliers.update(editing.id, data)
    } else {
      await db.suppliers.add({
        id: uuidv4(),
        ...data,
        balance: 0,
        createdAt: now,
      })
    }
    setShowSupplierForm(false)
  }

  const openPurchase = () => {
    setPurchaseSupplierId(suppliers[0]?.id || '')
    setPurchaseItems([{ productId: '', name: '', quantity: '1', cost: '' }])
    setPurchaseNote('')
    setShowPurchaseForm(true)
  }

  const addPurchaseLine = () => {
    setPurchaseItems([...purchaseItems, { productId: '', name: '', quantity: '1', cost: '' }])
  }

  const updatePurchaseLine = (idx: number, field: string, value: string) => {
    const next = [...purchaseItems]
    if (field === 'productId') {
      const product = products.find((p) => p.id === value)
      next[idx] = {
        ...next[idx],
        productId: value,
        name: product?.name || '',
        cost: product ? String(product.cost) : next[idx].cost,
      }
    } else {
      next[idx] = { ...next[idx], [field]: value }
    }
    setPurchaseItems(next)
  }

  const savePurchase = async () => {
    const supplier = suppliers.find((s) => s.id === purchaseSupplierId)
    if (!supplier) return
    const items = purchaseItems
      .filter((i) => i.productId && parseFloat(i.quantity) > 0)
      .map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: parseInt(i.quantity) || 0,
        cost: parseFloat(i.cost) || 0,
      }))
    if (items.length === 0) return

    const total = items.reduce((s, i) => s + i.quantity * i.cost, 0)
    const now = new Date().toISOString()
    const user = (() => {
      try { return JSON.parse(sessionStorage.getItem('currentUser') || '{}') } catch { return {} }
    })()

    const po: PurchaseOrder = {
      id: uuidv4(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      items,
      status: 'received',
      total,
      note: purchaseNote.trim() || undefined,
      createdAt: now,
      receivedAt: now,
      synced: false,
    }

    await db.transaction('rw', db.purchases, db.products, db.stockMovements, db.outbox, async () => {
      await db.purchases.add(po)

      for (const item of items) {
        const product = await db.products.get(item.productId)
        if (!product) continue
        const previousStock = product.stock
        const newStock = previousStock + item.quantity
        await db.products.update(item.productId, {
          stock: newStock,
          cost: item.cost, // update last cost
          updatedAt: now,
        })
        await db.stockMovements.add({
          id: uuidv4(),
          productId: item.productId,
          productName: item.name,
          type: 'purchase',
          quantity: item.quantity,
          previousStock,
          newStock,
          referenceId: po.id,
          userId: user.id,
          createdAt: now,
          synced: false,
        })
      }

      await db.outbox.add({
        id: uuidv4(),
        type: 'purchase',
        payload: po,
        createdAt: now,
        retries: 0,
      })
    })

    setShowPurchaseForm(false)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Suppliers & Purchases</h1>
            <p className="text-sm text-ink-secondary">{suppliers.length} suppliers · {purchases.length} orders</p>
          </div>
          <div className="flex gap-2">
            {tab === 'purchases' && (
              <button
                onClick={openPurchase}
                className="flex items-center gap-2 h-10 px-3 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover"
              >
                <PackagePlus size={16} />
                <span className="hidden sm:inline">Receive Stock</span>
              </button>
            )}
            {tab === 'suppliers' && (
              <button
                onClick={openCreateSupplier}
                className="flex items-center gap-2 h-10 px-3 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Supplier</span>
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setTab('suppliers')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-smooth ${
              tab === 'suppliers' ? 'bg-primary text-white' : 'bg-surface-secondary text-ink-secondary'
            }`}
          >
            Suppliers
          </button>
          <button
            onClick={() => setTab('purchases')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-smooth ${
              tab === 'purchases' ? 'bg-primary text-white' : 'bg-surface-secondary text-ink-secondary'
            }`}
          >
            Purchases
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-pad">
        {tab === 'suppliers' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search suppliers…"
                className="w-full h-11 pl-10 pr-4 rounded-button bg-white border border-border focus:border-primary outline-none transition-smooth"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openEditSupplier(s)}
                  className="bg-white rounded-card shadow-card p-4 text-left hover:shadow-soft transition-smooth"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0">
                      <Truck size={18} className="text-ink-muted" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{s.name}</p>
                      {s.phone && <p className="text-sm text-ink-secondary">{s.phone}</p>}
                      <p className="text-xs text-ink-muted mt-1">
                        Balance: <span className="tabular-nums">{s.balance.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {filtered.length === 0 && <p className="text-center text-ink-muted py-12">No suppliers yet</p>}
          </>
        )}

        {tab === 'purchases' && (
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-secondary">
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium text-ink">{p.supplierName}</td>
                    <td className="px-4 py-3 text-ink-secondary hidden sm:table-cell">
                      {format(new Date(p.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-success">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {purchases.length === 0 && <p className="text-center text-ink-muted py-12">No purchases yet</p>}
          </div>
        )}
      </div>

      {/* Supplier form */}
      {showSupplierForm && (
        <div className="sheet-backdrop">
          <div className="sheet-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button onClick={() => setShowSupplierForm(false)} className="p-1 text-ink-muted"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
              <button onClick={saveSupplier} className="w-full h-12 rounded-button bg-primary text-white font-medium">
                {editing ? 'Save Changes' : 'Create Supplier'}
              </button>
              {editing && (
                <button
                  onClick={handleDeleteSupplier}
                  className="w-full h-11 rounded-button border border-danger/30 text-danger text-sm font-medium hover:bg-danger/5 flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete Supplier
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchase / Receive Stock form */}
      {showPurchaseForm && (
        <div className="sheet-backdrop">
          <div className="sheet-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Receive Stock</h2>
              <button onClick={() => setShowPurchaseForm(false)} className="p-1 text-ink-muted"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Supplier</label>
                <select
                  value={purchaseSupplierId}
                  onChange={(e) => setPurchaseSupplierId(e.target.value)}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {purchaseItems.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="block text-xs text-ink-secondary mb-1">Product</label>
                    <select
                      value={line.productId}
                      onChange={(e) => updatePurchaseLine(idx, 'productId', e.target.value)}
                      className="w-full h-10 px-2 rounded-button bg-surface-secondary text-sm outline-none"
                    >
                      <option value="">Select…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs text-ink-secondary mb-1">Qty</label>
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updatePurchaseLine(idx, 'quantity', e.target.value)}
                      className="w-full h-10 px-2 rounded-button bg-surface-secondary text-sm tabular-nums outline-none"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs text-ink-secondary mb-1">Cost</label>
                    <input
                      type="number"
                      value={line.cost}
                      onChange={(e) => updatePurchaseLine(idx, 'cost', e.target.value)}
                      className="w-full h-10 px-2 rounded-button bg-surface-secondary text-sm tabular-nums outline-none"
                    />
                  </div>
                </div>
              ))}

              <button onClick={addPurchaseLine} className="text-sm text-primary font-medium">
                + Add line
              </button>

              <Field label="Note" value={purchaseNote} onChange={setPurchaseNote} />

              <button onClick={savePurchase} className="w-full h-12 rounded-button bg-primary text-white font-medium">
                Receive & Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-ink-secondary mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary focus:bg-white outline-none transition-smooth text-sm"
      />
    </div>
  )
}
