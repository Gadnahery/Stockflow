import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import { haptic } from '../../lib/util'

function Spinner() {
  return (
    <div className="auth-canvas min-h-full flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
    </div>
  )
}

export default function LoginPage() {
  const { signIn, session, member, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Existing session → leave login
  useEffect(() => {
    if (loading || busy) return
    if (!session) return
    navigate(member ? (from.startsWith('/login') ? '/' : from) : '/onboarding', { replace: true })
  }, [loading, session, member, from, navigate, busy])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { hasBusiness } = await signIn(email.trim(), password)
      haptic(20)
      if (hasBusiness) {
        const dest = from.startsWith('/login') ? '/' : from
        navigate(dest, { replace: true })
      } else {
        navigate('/onboarding', { replace: true })
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Sign in failed'
      setError(/invalid login/i.test(raw) ? 'Wrong email or password' : raw)
      haptic(50)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (session && !busy) return <Spinner />

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your StockFlow business"
      footer={
        <>
          <p>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </p>
          <p>
            New here?{' '}
            <Link to="/signup" className="auth-link">Create an account</Link>
          </p>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="auth-label" htmlFor="login-email">Email</label>
          <input id="login-email" className="field" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
        </div>
        <div>
          <label className="auth-label" htmlFor="login-password">Password</label>
          <input id="login-password" className="field" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="press auth-btn-primary">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
