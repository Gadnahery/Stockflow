import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X, Wallet, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import type { Expense } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Maintenance', 'Other']

export default function ExpensesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ category: 'Other', amount: '', paymentMethod: 'cash', note: '' })
  const expenses = useLiveQuery(
    () => db.expenses.orderBy('createdAt').reverse().toArray(),
    []
  ) || []

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const openEdit = (e: Expense) => {
    setEditingId(e.id)
    setForm({
      category: e.category,
      amount: String(e.amount),
      paymentMethod: e.paymentMethod,
      note: e.note || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    await db.expenses.delete(id)
  }

  const save = async () => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return
    const user = (() => {
      try { return JSON.parse(sessionStorage.getItem('currentUser') || '{}') } catch { return {} }
    })()

    if (editingId) {
      await db.expenses.update(editingId, {
        category: form.category,
        amount,
        paymentMethod: form.paymentMethod,
        note: form.note.trim() || undefined,
      })
    } else {
      const expense: Expense = {
        id: uuidv4(),
        category: form.category,
        amount,
        paymentMethod: form.paymentMethod,
        note: form.note.trim() || undefined,
        userId: user.id,
        createdAt: new Date().toISOString(),
        synced: false,
      }
      await db.expenses.add(expense)
      await db.outbox.add({
        id: uuidv4(),
        type: 'expense',
        payload: expense,
        createdAt: expense.createdAt,
        retries: 0,
      })
    }
    setShowForm(false)
    setEditingId(null)
    setForm({ category: 'Other', amount: '', paymentMethod: 'cash', note: '' })
  }

  return (
    <div className="h-full flex flex-col">
      <header className="page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Expenses</h1>
            <p className="text-sm text-ink-secondary">
              Total: <span className="tabular-nums font-medium text-ink">{total.toLocaleString()} TZS</span>
            </p>
          </div>
          <button
            onClick={() => { setEditingId(null); setForm({ category: "Other", amount: "", paymentMethod: "cash", note: "" }); setShowForm(true) }}
            className="flex items-center gap-2 h-10 px-4 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-smooth"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Expense</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-pad">
        <div className="space-y-3">
          {expenses.map((e) => (
            <div key={e.id} className="bg-white rounded-card shadow-card p-4 flex items-center gap-4 group">
              <button onClick={() => openEdit(e)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
                <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0">
                  <Wallet size={18} className="text-ink-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink">{e.category}</p>
                  <p className="text-xs text-ink-muted">
                    {format(new Date(e.createdAt), 'dd MMM yyyy HH:mm')} · {e.paymentMethod}
                  </p>
                  {e.note && <p className="text-xs text-ink-secondary mt-0.5 truncate">{e.note}</p>}
                </div>
                <p className="font-semibold tabular-nums text-ink">{e.amount.toLocaleString()}</p>
              </button>
              <button
                onClick={() => handleDelete(e.id)}
                className="p-2 text-ink-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-smooth"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="text-center text-ink-muted py-12">No expenses recorded</p>
          )}
        </div>
      </div>

      {showForm && (
        <div className="sheet-backdrop">
          <div className="sheet-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="p-1 text-ink-muted hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Amount *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm tabular-nums"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Note</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none text-sm"
                />
              </div>
              <button
                onClick={save}
                className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-smooth"
              >
                {editingId ? "Save Changes" : "Save Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
