import { useI18n } from '../../i18n/I18nContext'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const { t, locale, setLocale } = useI18n()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={sent ? undefined : 'We’ll email you a secure link'}
      footer={
        !sent ? (
          <Link to="/login" className="auth-link">
            Back to sign in
          </Link>
        ) : null
      }
    >
      {sent ? (
        <div className="text-center space-y-4 py-1">
          <div className="mx-auto h-14 w-14 rounded-full bg-[#E8F0FE] text-[#007AFF] flex items-center justify-center text-2xl">✉</div>
          <p className="text-[15px] text-[#636366] leading-relaxed">
            If an account exists for <strong className="text-[#1C1C1E]">{email}</strong>, a reset link is on its way.
          </p>
          <Link to="/login" className="press auth-btn-primary inline-flex items-center justify-center no-underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="auth-label" htmlFor="fp-email">Email</label>
            <input id="fp-email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="press auth-btn-primary">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
