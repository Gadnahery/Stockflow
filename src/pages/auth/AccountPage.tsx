import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, CreditCard, Users, ChevronRight } from 'lucide-react'
import Screen from '../../components/ui/Screen'
import { useAuth, setDevicePin } from '../../contexts/AuthContext'
import { useUi } from '../../store/uiStore'
import { haptic } from '../../lib/util'
import { supabase, getBusinessId } from '../../lib/supabase'
import { usePermission } from '../../hooks/usePermission'

export default function AccountPage() {
  const { user, member, business, updatePassword, signOut, lockWithPin, refreshMembership } = useAuth()
  const { can } = usePermission()
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [bizName, setBizName] = useState(business?.name || '')
  const [savingBiz, setSavingBiz] = useState(false)

  const onPassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwdError('')
    if (password.length < 8) {
      setPwdError('At least 8 characters')
      return
    }
    if (password !== confirm) {
      setPwdError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      toast('Password updated', 'success')
      haptic(20)
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : 'Could not update password')
      toast('Password update failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onPin = (e: FormEvent) => {
    e.preventDefault()
    if (pin.length < 4 || pin.length > 6) {
      toast('PIN must be 4–6 digits', 'error')
      return
    }
    setDevicePin(pin)
    setPin('')
    toast('Device PIN saved on this device', 'success')
    haptic(20)
  }

  const saveBusinessName = async () => {
    const name = bizName.trim()
    if (!name) return
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase) return
    setSavingBiz(true)
    try {
      const { error } = await supabase.from('businesses').update({ name }).eq('id', bizId)
      if (error) throw error
      await refreshMembership()
      toast('Business name updated', 'success')
    } catch (e) {
      toast((e as Error).message || 'Could not update name', 'error')
    } finally {
      setSavingBiz(false)
    }
  }

  return (
    <Screen title="Account" subtitle="Profile, business and security">
      <div className="space-y-6 md:max-w-lg pb-8">
        <div className="bg-white rounded-[22px] shadow-card p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#3395FF] to-[#0062CC] text-white flex items-center justify-center text-[24px] font-bold">
              {(member?.display_name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-bold truncate">{member?.display_name || 'User'}</p>
              <p className="text-[14px] text-ink-secondary truncate">{user?.email}</p>
              <p className="text-[13px] text-ink-muted capitalize mt-0.5">
                {member?.role || 'staff'}
                {business?.name ? ` · ${business.name}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Workspace</h2>
          <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
            <Link to="/billing" className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <span className="h-9 w-9 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
                <CreditCard size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">Plan & billing</span>
                <span className="block text-[13px] text-ink-muted">StockFlow Free</span>
              </span>
              <ChevronRight size={18} className="text-ink-muted" />
            </Link>
            {(can('MANAGE_USERS') || member?.role === 'owner') && (
              <Link to="/users" className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                <span className="h-9 w-9 rounded-[10px] bg-[#AF52DE]/10 text-[#AF52DE] flex items-center justify-center">
                  <Users size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold">Team & invites</span>
                  <span className="block text-[13px] text-ink-muted">Cashiers, managers, roles</span>
                </span>
                <ChevronRight size={18} className="text-ink-muted" />
              </Link>
            )}
            {(can('MANAGE_SETTINGS') || member?.role === 'owner') && (
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-9 w-9 rounded-[10px] bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center">
                    <Building2 size={18} />
                  </span>
                  <span className="text-[15px] font-semibold">Business name</span>
                </div>
                <div className="flex gap-2">
                  <input
                    className="field flex-1"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="Store name"
                  />
                  <button
                    type="button"
                    disabled={savingBiz || !bizName.trim() || bizName.trim() === business?.name}
                    onClick={() => void saveBusinessName()}
                    className="press h-[46px] px-4 rounded-[14px] bg-primary text-white text-[14px] font-semibold disabled:opacity-40"
                  >
                    {savingBiz ? '…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Security</h2>
          <div className="bg-white rounded-[22px] shadow-card p-5 space-y-5">
            <form onSubmit={onPassword} className="space-y-3">
              <p className="text-[15px] font-semibold">Change password</p>
              <input
                className="field w-full"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
              <input
                className="field w-full"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {pwdError && <p className="text-[13px] text-danger">{pwdError}</p>}
              <button type="submit" disabled={busy} className="press h-11 px-5 rounded-[14px] bg-primary text-white text-[14px] font-semibold disabled:opacity-50">
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </form>

            <form onSubmit={onPin} className="space-y-3 border-t border-border pt-5">
              <p className="text-[15px] font-semibold">Device PIN</p>
              <p className="text-[13px] text-ink-secondary">Unlocks this device after idle lock. Not your login password.</p>
              <input
                className="field w-full tracking-[0.3em] text-center text-lg"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
              <button type="submit" className="press h-11 px-5 rounded-[14px] bg-black/[0.06] text-[14px] font-semibold">
                Save PIN on this device
              </button>
            </form>
          </div>
        </section>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => lockWithPin()}
            className="press w-full h-12 rounded-[14px] bg-black/[0.06] font-semibold"
          >
            Lock screen now
          </button>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
            className="press w-full h-12 rounded-[14px] text-danger font-semibold bg-red-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </Screen>
  )
}
