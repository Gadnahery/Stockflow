import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, User, X, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import type { Customer } from '../types'
import { v4 as uuidv4 } from 'uuid'

const emptyForm = { name: '', phone: '', email: '', address: '', creditLimit: '0', notes: '' }

export default function CustomersPage() {
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []) || []

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.phone && c.phone.includes(query))
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (c: Customer) => {
    setEditing(c)
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: String(c.creditLimit || 0),
      notes: c.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Delete customer "${editing.name}"?`)) return
    await db.customers.delete(editing.id)
    setShowForm(false)
  }

  const save = async () => {
    if (!form.name.trim()) return
    const now = new Date().toISOString()
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      creditLimit: parseFloat(form.creditLimit) || 0,
      notes: form.notes.trim() || undefined,
      updatedAt: now,
    }

    if (editing) {
      await db.customers.update(editing.id, data)
    } else {
      await db.customers.add({
        id: uuidv4(),
        ...data,
        balance: 0,
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
            <h1 className="text-xl font-semibold text-ink">Customers</h1>
            <p className="text-sm text-ink-secondary">{customers.length} customers</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-smooth"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Customer</span>
          </button>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full h-11 pl-10 pr-4 rounded-button bg-surface-secondary border border-transparent focus:border-primary focus:bg-white outline-none transition-smooth"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openEdit(c)}
              className="bg-white rounded-card shadow-card p-4 hover:shadow-soft transition-smooth text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">{c.name}</p>
                  {c.phone && <p className="text-sm text-ink-secondary">{c.phone}</p>}
                  <div className="mt-2 flex gap-4 text-xs">
                    <span className="text-ink-muted">
                      Balance: <span className="tabular-nums font-medium text-ink">{c.balance.toLocaleString()}</span>
                    </span>
                    {c.creditLimit > 0 && (
                      <span className="text-ink-muted">
                        Limit: <span className="tabular-nums">{c.creditLimit.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-ink-muted py-12">No customers found</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full md:max-w-md bg-white rounded-t-2xl md:rounded-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-ink-muted hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <Field label="Credit Limit" value={form.creditLimit} type="number" onChange={(v) => setForm({ ...form, creditLimit: v })} />
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-button bg-surface-secondary border border-transparent focus:border-primary focus:bg-white outline-none transition-smooth text-sm resize-none"
                />
              </div>
              <button
                onClick={save}
                className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-smooth"
              >
                {editing ? 'Save Changes' : 'Create Customer'}
              </button>
              {editing && (
                <button
                  onClick={handleDelete}
                  className="w-full h-11 rounded-button border border-danger/30 text-danger text-sm font-medium hover:bg-danger/5 transition-smooth flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete Customer
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
