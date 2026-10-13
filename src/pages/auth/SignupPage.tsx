import { useI18n } from '../../i18n/I18nContext'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import { haptic } from '../../lib/util'

export default function SignupPage() {
  const { t, locale, setLocale } = useI18n()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const strength =
    password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      const { needsVerification } = await signUp(email.trim(), password, fullName.trim())
      haptic(25)
      if (needsVerification) setDone(true)
      else navigate('/onboarding', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
      haptic(50)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${email}`}>
        <div className="text-center py-2 space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-[#E8F8EE] text-[#1E9E54] flex items-center justify-center text-2xl font-bold">
            ✓
          </div>
          <p className="text-[15px] text-[#636366] leading-relaxed">
            Open the link to activate your account, then come back and sign in.
          </p>
          <Link to="/login" className="press auth-btn-primary inline-flex items-center justify-center no-underline">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Start your business on StockFlow"
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        <div>
          <label className="auth-label" htmlFor="su-name">Full name</label>
          <input id="su-name" className="field" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div>
          <label className="auth-label" htmlFor="su-email">Email</label>
          <input id="su-email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
        </div>
        <div>
          <label className="auth-label" htmlFor="su-pass">Password</label>
          <input id="su-pass" className="field" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          <div className="flex gap-1.5 mt-2 px-0.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  strength >= i
                    ? strength === 1
                      ? 'bg-[#E0333C]'
                      : strength === 2
                        ? 'bg-[#C96A00]'
                        : 'bg-[#1E9E54]'
                    : 'bg-[#E5E5EA]'
                }`}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="auth-label" htmlFor="su-confirm">Confirm password</label>
          <input id="su-confirm" className="field" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" disabled={busy} className="press auth-btn-primary mt-1">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
