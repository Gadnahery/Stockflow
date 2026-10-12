import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Shield, Mail, UserX, RefreshCw } from 'lucide-react'
import Screen from '../components/ui/Screen'
import { useAuth } from '../contexts/AuthContext'
import { usePermission } from '../hooks/usePermission'
import { useUi } from '../store/uiStore'
import { supabase, getBusinessId } from '../lib/supabase'
import type { Permission } from '../types'
import { v4 as uuidv4 } from 'uuid'

const FREE_SEATS = 10

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
  business_owner: ALL_PERMISSIONS.map((p) => p.key),
  business_manager: [
    'CREATE_SALE', 'VOID_SALE', 'REFUND_SALE', 'APPLY_DISCOUNT', 'ADJUST_STOCK',
    'VIEW_PROFIT', 'MANAGE_PRODUCTS', 'MANAGE_CUSTOMERS', 'MANAGE_SUPPLIERS',
    'VIEW_REPORTS', 'MANAGE_SHIFTS', 'MANAGE_USERS', 'CHANGE_PRICE', 'MANAGE_SETTINGS',
  ],
  cashier: ['CREATE_SALE', 'APPLY_DISCOUNT'],
  storekeeper: ['ADJUST_STOCK', 'MANAGE_PRODUCTS', 'MANAGE_SUPPLIERS'],
  accountant: ['VIEW_REPORTS', 'VIEW_PROFIT', 'EXPORT_DATA'],
  waiter: ['CREATE_SALE'],
  auditor: ['VIEW_REPORTS', 'VIEW_PROFIT', 'EXPORT_DATA'],
}

const ROLE_LABELS: Record<string, string> = {
  business_owner: 'Owner',
  owner: 'Owner',
  business_manager: 'Manager',
  manager: 'Manager',
  cashier: 'Cashier',
  storekeeper: 'Storekeeper',
  accountant: 'Accountant',
  waiter: 'Waiter',
  auditor: 'Auditor',
  platform_admin: 'Platform admin',
}

type MemberRow = {
  id: string
  user_id: string
  role: string
  permissions: string[]
  status: string
  display_name: string | null
  email?: string | null
}

type InviteRow = {
  id: string
  email: string
  role: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export default function UsersPage() {
  const { can } = usePermission()
  const { member: me, business } = useAuth()
  const toast = useUi((s) => s.toast)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    email: '',
    role: 'cashier',
    permissions: [...ROLE_PRESETS.cashier] as Permission[],
  })

  const allowed = can('MANAGE_USERS')

  const load = useCallback(async () => {
    const bizId = getBusinessId() || me?.business_id
    if (!bizId || !supabase) {
      setLoading(false)
      setError('Not signed in to a business')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: mems, error: mErr } = await supabase
        .from('business_members')
        .select('id, user_id, role, permissions, status, display_name')
        .eq('business_id', bizId)
        .order('created_at', { ascending: true })
      if (mErr) throw mErr

      const rows: MemberRow[] = (mems || []).map((m) => ({
        ...m,
        permissions: (m.permissions as string[]) || [],
      }))

      // Enrich with profile emails where possible
      const userIds = rows.map((r) => r.user_id).filter(Boolean)
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
        const byId = new Map((profiles || []).map((p) => [p.id, p]))
        for (const r of rows) {
          const p = byId.get(r.user_id)
          if (p) {
            r.email = p.email
            if (!r.display_name && p.full_name) r.display_name = p.full_name
          }
        }
      }
      setMembers(rows)

      const { data: inv, error: iErr } = await supabase
        .from('invites')
        .select('id, email, role, token, expires_at, accepted_at, created_at')
        .eq('business_id', bizId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
      if (iErr) throw iErr
      setInvites((inv || []) as InviteRow[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [me?.business_id])

  useEffect(() => {
    void load()
  }, [load])

  const setRole = (role: string) => {
    setForm({
      ...form,
      role,
      permissions: [...(ROLE_PRESETS[role] || ROLE_PRESETS.cashier)],
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

  const sendInvite = async () => {
    const email = form.email.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      toast('Enter a valid email', 'error')
      return
    }
    const bizId = getBusinessId() || me?.business_id
    if (!bizId || !supabase) return
    setBusy(true)
    try {
      const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 8)
      if (members.length >= FREE_SEATS) {
        toast(`Free plan allows ${FREE_SEATS} team members. Remove someone or upgrade later.`, 'error')
        setBusy(false)
        return
      }
      const { error: insErr } = await supabase.from('invites').insert({
        business_id: bizId,
        email,
        role: form.role,
        permissions: form.permissions,
        branch_ids: me?.branch_ids || [],
        token,
        invited_by: me?.user_id,
      })
      if (insErr) throw insErr

      // Best-effort: copy invite link for the owner to share (email SMTP may not be branded yet)
      const link = `${window.location.origin}/accept-invite?token=${token}`
      try {
        await navigator.clipboard.writeText(link)
        toast('Invite created — link copied to clipboard', 'success')
      } catch {
        toast(`Invite created. Link: ${link}`, 'success')
      }
      setShowInvite(false)
      setForm({ email: '', role: 'cashier', permissions: [...ROLE_PRESETS.cashier] })
      await load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Could not create invite', 'error')
    } finally {
      setBusy(false)
    }
  }

  const suspendMember = async (row: MemberRow) => {
    if (row.user_id === me?.user_id) {
      toast('You cannot suspend yourself', 'error')
      return
    }
    if (row.role === 'owner' || row.role === 'business_owner') {
      toast('Cannot suspend the owner', 'error')
      return
    }
    if (!supabase) return
    const { error: uErr } = await supabase
      .from('business_members')
      .update({ status: 'suspended' })
      .eq('id', row.id)
    if (uErr) {
      toast(uErr.message, 'error')
      return
    }
    toast('Member suspended', 'success')
    await load()
  }

  const reactivateMember = async (row: MemberRow) => {
    if (!supabase) return
    const { error: uErr } = await supabase
      .from('business_members')
      .update({ status: 'active' })
      .eq('id', row.id)
    if (uErr) {
      toast(uErr.message, 'error')
      return
    }
    toast('Member reactivated', 'success')
    await load()
  }

  const revokeInvite = async (inv: InviteRow) => {
    if (!supabase) return
    const { error: dErr } = await supabase.from('invites').delete().eq('id', inv.id)
    if (dErr) {
      toast(dErr.message, 'error')
      return
    }
    toast('Invite revoked', 'success')
    await load()
  }

  const copyInviteLink = async (inv: InviteRow) => {
    const link = `${window.location.origin}/accept-invite?token=${inv.token}`
    try {
      await navigator.clipboard.writeText(link)
      toast('Invite link copied', 'success')
    } catch {
      toast(link, 'success')
    }
  }

  if (!allowed) {
    return (
      <Screen title="Team" subtitle="Users and permissions">
        <div className="rounded-[22px] bg-white shadow-card p-8 text-center text-ink-secondary">
          You need <strong>Manage users</strong> permission to view this page.
        </div>
      </Screen>
    )
  }

  return (
    <Screen
      title="Team"
      subtitle={business?.name || 'Staff and invites'}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="press h-9 w-9 rounded-full flex items-center justify-center text-ink-secondary"
            aria-label="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="press h-9 px-3 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5"
          >
            <Plus size={16} /> Invite
          </button>
        </div>
      }
    >
      <div className="space-y-6 md:max-w-2xl pb-8">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-[18px] bg-white shadow-card skeleton" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-[18px] bg-red-50 text-danger p-4 text-[14px]">{error}</div>
        )}

        {!loading && !error && members.length === 0 && (
          <div className="rounded-[22px] bg-white shadow-card p-8 text-center">
            <p className="text-ink-secondary mb-4">No team members yet.</p>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="press h-11 px-5 rounded-[14px] bg-primary text-white font-semibold"
            >
              Invite staff
            </button>
          </div>
        )}

        {!loading && members.length > 0 && (
          <div>
            <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Members</h2>
            <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
              {members.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${i < members.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#3395FF] to-[#0062CC] text-white flex items-center justify-center text-[15px] font-bold shrink-0">
                    {(m.display_name || m.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate">
                      {m.display_name || m.email || 'Member'}
                      {m.user_id === me?.user_id && (
                        <span className="ml-1.5 text-[12px] font-medium text-ink-muted">(you)</span>
                      )}
                    </p>
                    <p className="text-[13px] text-ink-secondary truncate">
                      <span className="capitalize">{ROLE_LABELS[m.role] || m.role}</span>
                      {m.email ? ` · ${m.email}` : ''}
                      {m.status !== 'active' && (
                        <span className="ml-1 text-warning capitalize">· {m.status}</span>
                      )}
                    </p>
                  </div>
                  {m.status === 'active' && m.role !== 'owner' && m.role !== 'business_owner' && m.user_id !== me?.user_id && (
                    <button
                      type="button"
                      onClick={() => void suspendMember(m)}
                      className="press h-9 px-3 rounded-full text-[13px] font-medium text-danger bg-red-50"
                      title="Suspend"
                    >
                      <UserX size={16} />
                    </button>
                  )}
                  {m.status === 'suspended' && (
                    <button
                      type="button"
                      onClick={() => void reactivateMember(m)}
                      className="press h-9 px-3 rounded-full text-[13px] font-medium text-success bg-emerald-50"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {invites.length > 0 && (
          <div>
            <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Pending invites</h2>
            <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
              {invites.map((inv, i) => (
                <div
                  key={inv.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${i < invites.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="h-10 w-10 rounded-full bg-[#E8F0FE] text-primary flex items-center justify-center shrink-0">
                    <Mail size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate">{inv.email}</p>
                    <p className="text-[13px] text-ink-secondary capitalize">
                      {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyInviteLink(inv)}
                    className="press h-9 px-3 rounded-full text-[13px] font-medium text-primary bg-primary/10"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => void revokeInvite(inv)}
                    className="press h-9 w-9 rounded-full flex items-center justify-center text-ink-muted"
                    aria-label="Revoke"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[12px] text-ink-muted px-1 flex items-start gap-1.5">
          <Shield size={14} className="mt-0.5 shrink-0" />
          Invites create a link the staff member opens after signing up. Email delivery depends on Supabase Auth SMTP configuration.
        </p>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setShowInvite(false)}
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-t-[28px] sm:rounded-[28px] shadow-float">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
              <h2 className="text-[20px] font-bold tracking-tight">Invite staff</h2>
              <button type="button" onClick={() => setShowInvite(false)} className="p-1 text-ink-muted" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="field w-full"
                  placeholder="cashier@example.com"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setRole(e.target.value)}
                  className="field w-full"
                >
                  <option value="business_manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="storekeeper">Storekeeper</option>
                  <option value="accountant">Accountant</option>
                  <option value="waiter">Waiter</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-ink-secondary mb-2">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-[13px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(p.key)}
                        onChange={() => togglePermission(p.key)}
                        className="rounded border-border text-primary"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendInvite()}
                className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold disabled:opacity-60"
              >
                {busy ? 'Creating…' : 'Create invite link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}
