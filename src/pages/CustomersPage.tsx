import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, User, Trash2, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { db, audit } from '../lib/db'
import type { Customer, Sale } from '../types'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { useUi } from '../store/uiStore'
import { fmtMoney } from '../lib/util'
import ReceiptModal from '../components/ReceiptModal'
import { useI18n } from '../i18n/I18nContext'

const emptyForm = { name: '', phone: '', email: '', address: '', creditLimit: '0', notes: '' }

type Filter = 'all' | 'owing' | 'credit'

export default function CustomersPage() {
  const { t } = useI18n()
  const confirm = useConfirm()
  const toast = useUi((s) => s.toast)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)

  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])
  const sales = useLiveQuery(() => db.sales.orderBy('createdAt').reverse().limit(500).toArray(), [])
  const loading = customers === undefined

  const stats = useMemo(() => {
    const list = customers || []
    const owing = list.filter((c) => c.balance > 0)
    const totalOwed = owing.reduce((t, c) => t + c.balance, 0)
    const totalLimit = list.reduce((t, c) => t + (c.creditLimit || 0), 0)
    return { count: list.length, owingCount: owing.length, totalOwed, totalLimit }
  }, [customers])

  const filtered = useMemo(() => {
    const list = customers || []
    const q = query.trim().toLowerCase()
    return list.filter((c) => {
      if (filter === 'owing' && !(c.balance > 0)) return false
      if (filter === 'credit' && !(c.creditLimit > 0)) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
    })
  }, [customers, query, filter])

  const customerSales = useMemo(() => {
    if (!editing || !sales) return []
    return sales.filter(
      (s) => s.customerId === editing.id || (s.customerName && s.customerName === editing.name),
    )
  }, [editing, sales])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setPayAmount('')
    setShowForm(true)
  }

  const openDetail = (c: Customer) => {
    setEditing(c)
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: String(c.creditLimit || 0),
      notes: c.notes || '',
    })
    setPayAmount('')
    setShowDetail(true)
  }

  const openEditFromDetail = () => {
    setShowDetail(false)
    setShowForm(true)
  }

  const receivePayment = async () => {
    if (!editing) return
    const amt = parseFloat(payAmount)
    if (!(amt > 0)) {
      toast('Enter an amount', 'error')
      return
    }
    const before = editing.balance
    if (before <= 0) {
      toast('Nothing to collect', 'info')
      return
    }
    const applied = Math.min(amt, before)
    const now = new Date().toISOString()
    await db.customers.update(editing.id, {
      balance: before - applied,
      updatedAt: now,
    })
    await audit('CUSTOMER_PAYMENT', 'customer', editing.id, {
      before: { balance: before },
      after: { balance: before - applied },
      reason: `Received ${applied} from ${editing.name}`,
    })
    await db.outbox.add({
      id: uuidv4(),
      type: 'customer_upsert',
      payload: { ...editing, balance: before - applied, updatedAt: now },
      createdAt: now,
      retries: 0,
    })
    const next = { ...editing, balance: before - applied, updatedAt: now }
    setEditing(next)
    setPayAmount('')
    toast(`Recorded ${fmtMoney(applied)}`, 'success')
  }

  const handleDelete = async () => {
    if (!editing) return
    const ok = await confirm({
      title: 'Delete customer?',
      message: `"${editing.name}" will be removed.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await db.customers.delete(editing.id)
    setShowForm(false)
    setShowDetail(false)
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
      const updated = { ...editing, ...data }
      await db.outbox.add({
        id: uuidv4(),
        type: 'customer_upsert',
        payload: updated,
        createdAt: now,
        retries: 0,
      })
    } else {
      const row = {
        id: uuidv4(),
        ...data,
        balance: 0,
        createdAt: now,
      }
      await db.customers.add(row)
      await db.outbox.add({
        id: uuidv4(),
        type: 'customer_upsert',
        payload: row,
        createdAt: now,
        retries: 0,
      })
    }
    setShowForm(false)
    toast('Customer saved', 'success')
  }

  return (
    <Screen
      title="Customers"
      subtitle={
        loading
          ? 'Loading…'
          : `${stats.count} · ${fmtMoney(stats.totalOwed)} outstanding`
      }
      action={
        <button
          type="button"
          onClick={openCreate}
          className="press h-9 px-3.5 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5"
        >
          <Plus size={16} /> Add
        </button>
      }
    >
      <div className="space-y-4 md:max-w-2xl pb-6">
        {/* Credit KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[18px] bg-white shadow-card p-4">
            <p className="text-[12px] font-medium text-ink-muted">Outstanding credit</p>
            <p className="text-[18px] font-bold tabular-nums text-warning mt-0.5">{fmtMoney(stats.totalOwed)}</p>
          </div>
          <div className="rounded-[18px] bg-white shadow-card p-4">
            <p className="text-[12px] font-medium text-ink-muted">Accounts owing</p>
            <p className="text-[18px] font-bold tabular-nums mt-0.5">{stats.owingCount}</p>
          </div>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="field w-full !pl-10"
            placeholder="Search name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {(
            [
              ['all', 'All'],
              ['owing', 'Owing'],
              ['credit', 'Has limit'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`press h-8 px-3 rounded-full text-[12px] font-semibold ${
                filter === id ? 'bg-primary text-white' : 'bg-black/[0.05] text-ink-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-[18px] bg-white shadow-card skeleton" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-12 text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#E8F0FE] text-primary flex items-center justify-center">
              <User size={26} />
            </div>
            <p className="text-[16px] font-semibold">No customers</p>
            <p className="text-[14px] text-ink-secondary mt-1 mb-4">
              {query || filter !== 'all' ? 'Try a different filter.' : 'Add customers for credit sales.'}
            </p>
            {!query && filter === 'all' && (
              <button type="button" onClick={openCreate} className="press h-11 px-5 rounded-[14px] bg-primary text-white font-semibold">
                Add customer
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
            {filtered.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openDetail(c)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                  i < filtered.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span className="h-11 w-11 rounded-full bg-gradient-to-br from-[#3395FF] to-[#0062CC] text-white flex items-center justify-center text-[15px] font-bold shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold truncate">{c.name}</span>
                  <span className="block text-[13px] text-ink-secondary truncate">
                    {c.phone || c.email || 'No contact'}
                    {c.creditLimit > 0 ? ` · Limit ${fmtMoney(c.creditLimit)}` : ''}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  {c.balance > 0 ? (
                    <span className="text-[14px] font-semibold text-warning tabular-nums">{fmtMoney(c.balance)}</span>
                  ) : (
                    <span className="text-[12px] text-ink-muted">—</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet: statement + collect */}
      <Sheet
        open={showDetail && !!editing}
        onClose={() => setShowDetail(false)}
        title={editing?.name || 'Customer'}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={openEditFromDetail} className="press flex-1 h-12 rounded-[14px] bg-black/[0.06] font-semibold">
              Edit
            </button>
            {editing && editing.balance > 0 && (
              <button
                type="button"
                onClick={() => void receivePayment()}
                className="press flex-1 h-12 rounded-[14px] bg-primary text-white font-semibold"
              >
                Collect
              </button>
            )}
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="rounded-[16px] bg-surface-secondary p-4 space-y-2 text-[14px]">
              {editing.phone && (
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Phone</span>
                  <span className="font-medium">{editing.phone}</span>
                </div>
              )}
              {editing.email && (
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Email</span>
                  <span className="font-medium truncate ml-4">{editing.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-secondary">Credit limit</span>
                <span className="font-medium tabular-nums">{fmtMoney(editing.creditLimit)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold">Balance owing</span>
                <span className={`font-bold tabular-nums ${editing.balance > 0 ? 'text-warning' : 'text-success'}`}>
                  {fmtMoney(editing.balance)}
                </span>
              </div>
            </div>

            {editing.balance > 0 && (
              <div className="rounded-[16px] bg-amber-50 p-4">
                <p className="text-[13px] font-semibold text-warning mb-2">Record payment</p>
                <div className="flex gap-2">
                  <input
                    className="field flex-1 !bg-white"
                    inputMode="decimal"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount received"
                  />
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(editing.balance))}
                    className="press h-[46px] px-3 rounded-[14px] bg-white text-[13px] font-semibold"
                  >
                    Full
                  </button>
                </div>
              </div>
            )}

            {editing.notes && (
              <p className="text-[13px] text-ink-secondary">
                <span className="font-semibold text-ink">Notes: </span>
                {editing.notes}
              </p>
            )}

            <div>
              <p className="text-[13px] font-semibold text-ink-secondary mb-2">Sales history</p>
              {customerSales.length === 0 ? (
                <p className="text-[14px] text-ink-muted py-4">No sales linked to this customer yet.</p>
              ) : (
                <div className="rounded-[16px] border border-border overflow-hidden divide-y divide-border">
                  {customerSales.slice(0, 20).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSale(s)}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left"
                    >
                      <Receipt size={16} className="text-ink-muted shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold">{s.receiptNumber}</span>
                        <span className="block text-[12px] text-ink-muted">
                          {format(new Date(s.createdAt), 'dd MMM yyyy HH:mm')} · {s.status}
                        </span>
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums">{fmtMoney(s.total)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit customer' : 'New customer'}
        footer={
          <div className="space-y-2">
            <button type="button" onClick={() => void save()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold">
              {editing ? 'Save changes' : 'Create customer'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="press w-full h-11 rounded-[14px] text-danger font-semibold bg-red-50 flex items-center justify-center gap-2"
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3.5">
          <div>
            <label className="auth-label">Name</label>
            <input className="field w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="auth-label">Phone</label>
            <input className="field w-full" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="auth-label">Email</label>
            <input className="field w-full" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="auth-label">Address</label>
            <input className="field w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="auth-label">Credit limit (TZS)</label>
            <input className="field w-full" inputMode="decimal" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
          </div>
          <div>
            <label className="auth-label">Notes</label>
            <textarea className="field w-full !h-auto py-3" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Sheet>

      {selectedSale && <ReceiptModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
    </Screen>
  )
}
