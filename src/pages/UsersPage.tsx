import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X, Shield } from 'lucide-react'
import { db } from '../lib/db'
import type { User, Permission } from '../types'
import { v4 as uuidv4 } from 'uuid'

const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'CREATE_SALE', label: 'Create sales' },
  { key: 'VOID_SALE', label: 'Void sales' },
  { key: 'REFUND_SALE', label: 'Refund sales' },
  { key: 'CHANGE_PRICE', label: 'Change prices' },
  { key: 'APPLY_DISCOUNT', label: 'Apply discounts' },
  { key: 'ADJUST_STOCK', label: 'Adjust stock' },
  { key: 'VIEW_PROFIT', label: 'View profit' },
  { key: 'EXPORT_DATA', label: 'Export data' },
  { key: 'MANAGE_USERS', label: 'Manage users' },
  { key: 'MANAGE_PRODUCTS', label: 'Manage products' },
  { key: 'MANAGE_CUSTOMERS', label: 'Manage customers' },
  { key: 'MANAGE_SUPPLIERS', label: 'Manage suppliers' },
  { key: 'VIEW_REPORTS', label: 'View reports' },
  { key: 'MANAGE_SHIFTS', label: 'Manage shifts' },
  { key: 'MANAGE_SETTINGS', label: 'Manage settings' },
]

const ROLE_PRESETS: Record<string, Permission[]> = {
  owner: ALL_PERMISSIONS.map((p) => p.key),
  manager: [
    'CREATE_SALE', 'VOID_SALE', 'REFUND_SALE', 'APPLY_DISCOUNT', 'ADJUST_STOCK',
    'VIEW_PROFIT', 'MANAGE_PRODUCTS', 'MANAGE_CUSTOMERS', 'MANAGE_SUPPLIERS',
    'VIEW_REPORTS', 'MANAGE_SHIFTS',
  ],
  cashier: ['CREATE_SALE', 'APPLY_DISCOUNT'],
  storekeeper: ['ADJUST_STOCK', 'MANAGE_PRODUCTS', 'MANAGE_SUPPLIERS'],
  accountant: ['VIEW_REPORTS', 'VIEW_PROFIT', 'EXPORT_DATA'],
}

export default function UsersPage() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({
    name: '',
    pin: '',
    role: 'cashier' as User['role'],
    permissions: ROLE_PRESETS.cashier as Permission[],
    active: true,
  })

  const users = useLiveQuery(() => db.users.toArray(), []) || []

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      pin: '',
      role: 'cashier',
      permissions: [...ROLE_PRESETS.cashier],
      active: true,
    })
    setShowForm(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name,
      pin: u.pin,
      role: u.role,
      permissions: [...u.permissions],
      active: u.active,
    })
    setShowForm(true)
  }

  const setRole = (role: User['role']) => {
    setForm({
      ...form,
      role,
      permissions: [...(ROLE_PRESETS[role] || [])],
    })
  }

  const togglePermission = (key: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }))
  }

  const save = async () => {
    if (!form.name.trim() || form.pin.length < 4) return
    if (editing) {
      await db.users.update(editing.id, {
        name: form.name.trim(),
        pin: form.pin,
        role: form.role,
        permissions: form.permissions,
        active: form.active,
      })
    } else {
      await db.users.add({
        id: uuidv4(),
        name: form.name.trim(),
        pin: form.pin,
        role: form.role,
        permissions: form.permissions,
        active: form.active,
      })
    }
    setShowForm(false)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Users & Permissions</h1>
            <p className="text-sm text-ink-secondary">{users.length} users</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add User</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-pad">
        <div className="space-y-3">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => openEdit(u)}
              className="w-full bg-white rounded-card shadow-card p-4 flex items-center gap-4 text-left hover:shadow-soft transition-smooth"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink">{u.name}</p>
                <p className="text-sm text-ink-secondary capitalize">{u.role}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                u.active ? 'bg-emerald-50 text-success' : 'bg-surface-secondary text-ink-muted'
              }`}>
                {u.active ? 'Active' : 'Inactive'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="sheet-backdrop">
          <div className="sheet-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editing ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-ink-muted"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">PIN * (min 4 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary outline-none text-sm tracking-widest"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-secondary mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setRole(e.target.value as User['role'])}
                  className="w-full h-11 px-3 rounded-button bg-surface-secondary outline-none text-sm"
                >
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="storekeeper">Storekeeper</option>
                  <option value="accountant">Accountant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-ink-secondary mb-2">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(p.key)}
                        onChange={() => togglePermission(p.key)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-border text-primary"
                />
                <span className="text-sm text-ink">Active</span>
              </label>

              <button onClick={save} className="w-full h-12 rounded-button bg-primary text-white font-medium">
                {editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
