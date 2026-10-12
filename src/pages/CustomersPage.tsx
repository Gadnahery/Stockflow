import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, User, Trash2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { db, audit } from '../lib/db'
import type { Customer } from '../types'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { fmtMoney } from '../lib/util'

const emptyForm = { name: '', phone: '', email: '', address: '', creditLimit: '0', notes: '' }

export default function CustomersPage() {
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)

  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])
  const loading = customers === undefined

  const filtered = useMemo(() => {
    const list = customers || []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)),
    )
  }, [customers, query])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setPayAmount('')
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
    setPayAmount('')
    setShowForm(true)
  }

  const receivePayment = async () => {
    if (!editing) return
    const amt = parseFloat(payAmount)
    if (!(amt > 0)) return
    const before = editing.balance
    const applied = Math.min(amt, before)
    await db.customers.update(editing.id, {
      balance: before - applied,
      updatedAt: new Date().toISOString(),
    })
    await audit('CUSTOMER_PAYMENT', 'customer', editing.id, {
      before: { balance: before },
      after: { balance: before - applied },
      reason: `Received ${applied} from ${editing.name}`,
    })
    setEditing({ ...editing, balance: before - applied })
    setPayAmount('')
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
    <Screen
      title="Customers"
      subtitle={loading ? 'Loading…' : `${(customers || []).length} customer${(customers || []).length === 1 ? '' : 's'}`}
      action={
        <button type="button" onClick={openCreate} className="press h-9 px-3.5 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5">
          <Plus size={16} /> Add
        </button>
      }
    >
      <div className="space-y-4 md:max-w-2xl pb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="field w-full !pl-10"
            placeholder="Search name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
              {query ? 'Try a different search.' : 'Add customers for credit sales and history.'}
            </p>
            {!query && (
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
                onClick={() => openEdit(c)}
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
                  </span>
                </span>
                <span className="text-right shrink-0">
                  {c.balance > 0 ? (
                    <span className="text-[14px] font-semibold text-warning tabular-nums">{fmtMoney(c.balance)}</span>
                  ) : (
                    <span className="text-[12px] text-ink-muted">Limit {fmtMoney(c.creditLimit)}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

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
              <button type="button" onClick={() => void handleDelete()} className="press w-full h-11 rounded-[14px] text-danger font-semibold bg-red-50 flex items-center justify-center gap-2">
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
          {editing && editing.balance > 0 && (
            <div className="rounded-[16px] bg-amber-50 p-4">
              <p className="text-[14px] font-semibold text-warning">Owes {fmtMoney(editing.balance)}</p>
              <div className="mt-2 flex gap-2">
                <input
                  className="field flex-1 !bg-white"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Amount received"
                />
                <button type="button" onClick={() => void receivePayment()} className="press h-[46px] px-4 rounded-[14px] bg-ink text-white text-[14px] font-semibold">
                  Record
                </button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </Screen>
  )
}
