import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ResetPasswordPage() {
  const { updatePassword, session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setBusy(false)
    }
  }

  if (!session && !done) {
    return (
      <div className="min-h-full flex items-center justify-center px-6 bg-[#F2F2F7]">
        <div className="text-center">
          <p className="text-[#5F5F66]">Open the link from your email to set a new password.</p>
          <Link to="/login" className="text-[#007AFF] font-medium mt-4 inline-block">Sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex items-center justify-center px-6 bg-[#F2F2F7]">
      <div className="w-full max-w-[380px] page-enter">
        <h1 className="text-[28px] font-bold text-[#1C1C1E] text-center mb-8">New password</h1>
        {done ? (
          <p className="text-center text-[#1E9E54]">Password updated. Redirecting…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">New password</label>
              <input className="field w-full" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Confirm</label>
              <input className="field w-full" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-[13px] text-[#E0333C]">{error}</p>}
            <button type="submit" disabled={busy} className="press w-full h-12 rounded-[14px] bg-[#007AFF] text-white font-semibold disabled:opacity-60">
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
