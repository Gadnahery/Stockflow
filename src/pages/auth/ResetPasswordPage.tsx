import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'

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
      setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setBusy(false)
    }
  }

  if (!session && !done) {
    return (
      <AuthShell title="Reset password" subtitle="Open the link from your email to continue">
        <Link to="/login" className="press auth-btn-primary inline-flex items-center justify-center no-underline">
          Back to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="New password" subtitle={done ? 'All set — redirecting…' : 'Choose a strong password'}>
      {done ? (
        <p className="text-center text-[#1E9E54] font-medium py-4">Password updated</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="auth-label" htmlFor="rp-pass">New password</label>
            <input id="rp-pass" className="field" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="auth-label" htmlFor="rp-confirm">Confirm</label>
            <input id="rp-confirm" className="field" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="press auth-btn-primary">
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
