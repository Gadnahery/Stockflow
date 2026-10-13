import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Wallet, Trash2 } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import type { Expense } from '../types'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { fmtMoney } from '../lib/util'
import { useI18n } from '../i18n/I18nContext'

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Maintenance', 'Other']
const METHODS = ['cash', 'mobile', 'card', 'bank']

export default function ExpensesPage() {
  const { t } = useI18n()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ category: 'Other', amount: '', paymentMethod: 'cash', note: '' })
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d')

  const expenses = useLiveQuery(() => db.expenses.orderBy('createdAt').reverse().toArray(), [])
  const loading = expenses === undefined

  const filtered = useMemo(() => {
    if (!expenses) return []
    const now = new Date()
    let from: Date | null = null
    if (period === 'today') from = startOfDay(now)
    else if (period === '7d') from = subDays(now, 7)
    else if (period === '30d') from = subDays(now, 30)
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (from && new Date(e.createdAt) < from) return false
      return true
    })
  }, [expenses, categoryFilter, period])

  const total = filtered.reduce((s, e) => s + e.amount, 0)

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of filtered) map.set(e.category, (map.get(e.category) || 0) + e.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  const openCreate = () => {
    setEditingId(null)
    setForm({ category: 'Other', amount: '', paymentMethod: 'cash', note: '' })
    setShowForm(true)
  }

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
    const ok = await confirm({
      title: 'Delete expense?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await db.expenses.delete(id)
  }

  const save = async () => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return
    const user = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('currentUser') || '{}')
      } catch {
        return {} as { id?: string }
      }
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
  }

  return (
    <Screen
      title="Expenses"
      subtitle={`${fmtMoney(total)} in view`}
      action={
        <button type="button" onClick={openCreate} className="press h-9 px-3.5 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5">
          <Plus size={16} /> Add
        </button>
      }
    >
      <div className="space-y-4 md:max-w-2xl pb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(['today', '7d', '30d', 'all'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              className={`press shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold ${
                period === id ? 'bg-primary text-white' : 'bg-white text-ink-secondary shadow-card'
              }`}
            >
              {id === 'today' ? 'Today' : id === 'all' ? 'All' : id === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`press shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold ${
              categoryFilter === 'all' ? 'bg-ink text-white' : 'bg-black/[0.05] text-ink-secondary'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`press shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold ${
                categoryFilter === c ? 'bg-ink text-white' : 'bg-black/[0.05] text-ink-secondary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {byCategory.length > 0 && (
          <div className="bg-white rounded-[22px] shadow-card p-4">
            <p className="text-[13px] font-semibold text-ink-secondary mb-2">By category</p>
            <div className="space-y-1.5">
              {byCategory.slice(0, 5).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between text-[14px]">
                  <span className="text-ink-secondary">{cat}</span>
                  <span className="tabular-nums font-medium">{fmtMoney(amt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-[18px] bg-white shadow-card skeleton" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-12 text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#FFF1E8] text-warning flex items-center justify-center">
              <Wallet size={26} />
            </div>
            <p className="text-[16px] font-semibold">No expenses</p>
            <p className="text-[14px] text-ink-secondary mt-1 mb-4">Record rent, utilities, and other costs.</p>
            <button type="button" onClick={openCreate} className="press h-11 px-5 rounded-[14px] bg-primary text-white font-semibold">
              Add expense
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
            {filtered.map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${i < filtered.length - 1 ? 'border-b border-border' : ''}`}
              >
                <button type="button" onClick={() => openEdit(e)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <span className="h-10 w-10 rounded-[12px] bg-surface-secondary flex items-center justify-center shrink-0">
                    <Wallet size={18} className="text-ink-muted" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold truncate">{e.category}</span>
                    <span className="block text-[13px] text-ink-secondary truncate">
                      {format(new Date(e.createdAt), 'dd MMM · HH:mm')} · {e.paymentMethod}
                      {e.note ? ` · ${e.note}` : ''}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums shrink-0">{fmtMoney(e.amount)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(e.id)}
                  className="press h-9 w-9 rounded-full text-danger bg-red-50 flex items-center justify-center shrink-0"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Edit expense' : 'Add expense'}
        footer={
          <button type="button" onClick={() => void save()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold">
            {editingId ? 'Save changes' : 'Save expense'}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="auth-label">Category</label>
            <select className="field w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="auth-label">Amount (TZS)</label>
            <input className="field w-full" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          </div>
          <div>
            <label className="auth-label">Payment method</label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, paymentMethod: m })}
                  className={`press h-9 px-3 rounded-full text-[13px] font-semibold capitalize ${
                    form.paymentMethod === m ? 'bg-primary text-white' : 'bg-black/[0.06] text-ink-secondary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="auth-label">Note</label>
            <input className="field w-full" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </Sheet>
    </Screen>
  )
}
