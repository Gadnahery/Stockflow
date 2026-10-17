import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Shield, Mail, UserX, RefreshCw } from 'lucide-react'
import Screen from '../components/ui/Screen'
import { useAuth } from '../contexts/AuthContext'
import { saveApprovalPin, listApprovalPins, removeApprovalPin } from '../lib/approvalPin'
import { usePermission } from '../hooks/usePermission'
import { useUi } from '../store/uiStore'
import { supabase, getBusinessId } from '../lib/supabase'
import type { Permission } from '../types'
import { checkCanAdd, DEFAULT_PLAN_LIMITS } from '../lib/planLimits'
import {
  PERMISSION_CATALOGUE,
  ROLE_PRESETS as CATALOGUE_PRESETS,
  ROLE_LABELS as CATALOGUE_ROLE_LABELS,
} from '../lib/permissions'
import { v4 as uuidv4 } from 'uuid'
import { useI18n } from '../i18n/I18nContext'


function teamLimitToast(memberCount: number) {
  let plan = DEFAULT_PLAN_LIMITS.starter
  try {
    const code = localStorage.getItem('sf_plan_code') || 'starter'
    plan = DEFAULT_PLAN_LIMITS[code] || DEFAULT_PLAN_LIMITS.starter
  } catch { /* starter */ }
  const gate = checkCanAdd('account', memberCount, plan)
  if (!gate.allowed) {
    return gate.messageEn
  }
  return null
}

const ALL_PERMISSIONS: { key: Permission; label: string }[] = PERMISSION_CATALOGUE.map((p) => ({
  key: p.key,
  label: p.labelEn,
}))

const ROLE_PRESETS: Record<string, Permission[]> = CATALOGUE_PRESETS as Record<string, Permission[]>

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATALOGUE_ROLE_LABELS).map(([k, v]) => [k, v.en]),
)

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
  const { t } = useI18n()
  const { can } = usePermission()
  const { member: me, business } = useAuth()
  const toast = useUi((s) => s.toast)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [busy, setBusy] = useState(false)
  /** invite = share link | create = owner sets email + password */
  const [addMode, setAddMode] = useState<'create' | 'invite'>('create')
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'cashier',
    permissions: [...ROLE_PRESETS.cashier] as Permission[],
    branchIds: [] as string[],
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

  const resetForm = () =>
    setForm({
      email: '',
      password: '',
      displayName: '',
      role: 'cashier',
      permissions: [...ROLE_PRESETS.cashier],
      branchIds: [],
    })

  /** Owner creates email + password; staff signs in and is already on this shop */
  const createStaffAccount = async () => {
    const email = form.email.trim().toLowerCase()
    const password = form.password
    if (!email || !email.includes('@')) {
      toast('Enter a valid email', 'error')
      return
    }
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error')
      return
    }
    const bizId = getBusinessId() || me?.business_id
    if (!bizId || !supabase) return
    {
      const msg = teamLimitToast(members.length)
      if (msg) {
        toast(msg, 'error')
        return
      }
    }
    setBusy(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const access = sess.session?.access_token
      if (!access) throw new Error('Not signed in')
      const r = await fetch('/api/staff/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          email,
          password,
          display_name: form.displayName.trim() || email.split('@')[0],
          role: form.role,
          permissions: form.permissions,
          business_id: bizId,
          branch_ids: form.branchIds || [],
        }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) throw new Error(data.error || 'Could not create staff')
      toast('Staff account created — they can sign in with that email and password', 'success')
      setShowInvite(false)
      resetForm()
      await load()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Could not create staff', 'error')
    } finally {
      setBusy(false)
    }
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
      {
        const msg = teamLimitToast(members.length)
        if (msg) {
          toast(msg, 'error')
          setBusy(false)
          return
        }
      }
      const expires = new Date()
      expires.setDate(expires.getDate() + 14)
      const { error: insErr } = await supabase.from('invites').insert({
        business_id: bizId,
        email,
        role: form.role,
        permissions: form.permissions,
        branch_ids: me?.branch_ids || [],
        token,
        invited_by: me?.user_id,
        expires_at: expires.toISOString(),
      })
      if (insErr) throw insErr

      const link = `${window.location.origin}/accept-invite?token=${token}`
      try {
        await navigator.clipboard.writeText(link)
        toast('Invite link copied — send it to your staff (valid 14 days)', 'success')
      } catch {
        toast(`Invite link: ${link}`, 'success')
      }
      setShowInvite(false)
      resetForm()
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
  
  const setMemberApprovalPin = async (m: MemberRow) => {
    const pin = window.prompt(
      `Approval PIN for ${m.display_name || m.email || 'member'} (4–6 digits). Used for void/refund override — not the device unlock PIN.`,
    )
    if (!pin) return
    if (!/^\d{4,6}$/.test(pin.trim())) {
      toast('PIN must be 4–6 digits', 'error')
      return
    }
    saveApprovalPin({
      memberId: m.id,
      name: m.display_name || m.email || 'Manager',
      pin: pin.trim(),
      permissions: m.permissions,
    })
    toast(`Approval PIN saved for ${m.display_name || m.email}`, 'success')
  }

  return (
      <Screen title={t('users.title')} subtitle={t('users.sub')}>
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
                  {m.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => void setMemberApprovalPin(m)}
                      className="press h-9 px-3 rounded-full text-[12px] font-semibold text-primary bg-primary/10"
                      title="Set approval PIN"
                    >
                      PIN
                    </button>
                  )}
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
          Easiest: create an account with email and password, then tell your cashier those details. Or send an invite link (valid 14 days).
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
              <h2 className="text-[20px] font-bold tracking-tight">Add staff</h2>
              <button type="button" onClick={() => setShowInvite(false)} className="p-1 text-ink-muted" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2 p-1 rounded-full bg-black/[0.05]">
                <button
                  type="button"
                  onClick={() => setAddMode('create')}
                  className={`flex-1 h-9 rounded-full text-[13px] font-semibold ${
                    addMode === 'create' ? 'bg-white text-ink shadow-soft' : 'text-ink-secondary'
                  }`}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('invite')}
                  className={`flex-1 h-9 rounded-full text-[13px] font-semibold ${
                    addMode === 'invite' ? 'bg-white text-ink shadow-soft' : 'text-ink-secondary'
                  }`}
                >
                  Invite link
                </button>
              </div>

              <p className="text-[12px] text-ink-muted leading-snug">
                {addMode === 'create'
                  ? 'You set their email and password. They sign in and already belong to this shop.'
                  : 'Copy a link and send it (WhatsApp/SMS). They sign up or sign in, then join this shop.'}
              </p>

              <div>
                <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Name</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="field w-full"
                  placeholder="e.g. Asha"
                />
              </div>
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
              {addMode === 'create' && (
                <div>
                  <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">Password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="field w-full"
                    placeholder="At least 6 characters"
                  />
                </div>
              )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
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
                onClick={() => void (addMode === 'create' ? createStaffAccount() : sendInvite())}
                className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold disabled:opacity-60"
              >
                {busy
                  ? 'Please wait…'
                  : addMode === 'create'
                    ? 'Create staff account'
                    : 'Create invite link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}
