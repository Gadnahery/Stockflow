import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, Package, X, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import type { Product } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { usePermission } from '../hooks/usePermission'

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  price: '',
  cost: '',
  stock: '',
  minStock: '',
  category: '',
  unit: 'piece',
}

export default function ProductsPage() {
  const { can } = usePermission()
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const products = useLiveQuery(() => db.products.filter(p => p.active).toArray().then(arr => arr.sort((a,b) => a.name.localeCompare(b.name))), []) || []

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()) ||
      (p.barcode && p.barcode.includes(query))
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      minStock: String(p.minStock ?? ''),
      category: p.category || '',
      unit: p.unit || 'piece',
    })
    setShowForm(true)
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Deactivate "${editing.name}"? It will be hidden from POS.`)) return
    await db.products.update(editing.id, { active: false, updatedAt: new Date().toISOString() })
    setShowForm(false)
  }

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.price) return
    const now = new Date().toISOString()
    const data = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseInt(form.stock) || 0,
      minStock: form.minStock ? parseInt(form.minStock) : undefined,
      category: form.category.trim() || undefined,
      unit: form.unit || 'piece',
      active: true,
      updatedAt: now,
    }

    if (editing) {
      await db.products.update(editing.id, data)
    } else {
      await db.products.add({
        id: uuidv4(),
        ...data,
        createdAt: now,
      })
    }
    setShowForm(false)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 bg-white border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">Products</h1>
            <p className="text-sm text-ink-secondary">{products.length} items</p>
          </div>
          {can('MANAGE_PRODUCTS') && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 h-10 px-4 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-smooth"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Product</span>
            </button>
          )}
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full h-11 pl-10 pr-4 rounded-button bg-surface-secondary border border-transparent focus:border-primary focus:bg-white outline-none transition-smooth"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-secondary">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="border-b border-border/60 hover:bg-surface-secondary/50 transition-smooth cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0">
                        <Package size={16} className="text-ink-muted" />
                      </div>
                      <div>
                        <p className="font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-ink-muted sm:hidden">{p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary hidden sm:table-cell">{p.sku}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {p.price.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                    p.stock <= (p.minStock || 0) ? 'text-warning' : 'text-ink'
                  }`}>
                    {p.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-ink-muted py-12">No products found</p>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-ink-muted hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU *" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
                <Field label="Barcode" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Selling Price *" value={form.price} type="number" onChange={(v) => setForm({ ...form, price: v })} />
                <Field label="Cost" value={form.cost} type="number" onChange={(v) => setForm({ ...form, cost: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stock" value={form.stock} type="number" onChange={(v) => setForm({ ...form, stock: v })} />
                <Field label="Min Stock" value={form.minStock} type="number" onChange={(v) => setForm({ ...form, minStock: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
                <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
              </div>
              <button
                onClick={save}
                className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-smooth mt-2"
              >
                {editing ? 'Save Changes' : 'Create Product'}
              </button>
              {editing && (
                <button
                  onClick={handleDelete}
                  className="w-full h-11 rounded-button border border-danger/30 text-danger text-sm font-medium hover:bg-danger/5 transition-smooth flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Deactivate Product
                </button>
              )}
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
