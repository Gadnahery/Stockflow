import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '../../components/ui/Screen'
import { useAuth, setDevicePin } from '../../contexts/AuthContext'
import { useUi } from '../../store/uiStore'
import { haptic } from '../../lib/util'

export default function AccountPage() {
  const { user, member, business, updatePassword, signOut, lockWithPin } = useAuth()
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [pwdError, setPwdError] = useState('')

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

  return (
    <Screen title="Account" subtitle="Profile and security">
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

        <form onSubmit={onPassword} className="bg-white rounded-[22px] shadow-card p-5 space-y-3">
          <h2 className="text-[16px] font-semibold text-ink">Change password</h2>
          <div>
            <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">New password</label>
            <input
              className="field w-full"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Confirm</label>
            <input
              className="field w-full"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {pwdError && <p className="text-[13px] text-danger">{pwdError}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="press w-full h-11 rounded-[14px] bg-primary text-white font-semibold disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>

        <form onSubmit={onPin} className="bg-white rounded-[22px] shadow-card p-5 space-y-3">
          <h2 className="text-[16px] font-semibold text-ink">Device PIN</h2>
          <p className="text-[13px] text-ink-muted">
            Used to unlock this device after idle. Stored only on this browser until server-side PIN hashing ships.
          </p>
          <div>
            <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">New PIN (4–6 digits)</label>
            <input
              className="field w-full"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
            />
          </div>
          <button
            type="submit"
            disabled={pin.length < 4}
            className="press w-full h-11 rounded-[14px] bg-primary text-white font-semibold disabled:opacity-50"
          >
            Save PIN
          </button>
        </form>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => lockWithPin()}
            className="press w-full h-12 rounded-[18px] bg-white shadow-card text-ink font-semibold"
          >
            Lock screen now
          </button>
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
            className="press w-full h-12 rounded-[18px] bg-white shadow-card text-danger font-semibold"
          >
            Sign out
          </button>
        </div>
      </div>
    </Screen>
  )
}
