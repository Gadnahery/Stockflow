import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { haptic } from '../../lib/util'

/**
 * Email + password only. No PIN here — PIN is the lock screen after you are already signed in.
 */
export default function LoginPage() {
  const { signIn, session, member, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Single redirect after auth is fully resolved — no intermediate flashes
  useEffect(() => {
    if (loading || busy) return
    if (!session) return
    navigate(member ? from : '/onboarding', { replace: true })
  }, [loading, session, member, from, navigate, busy])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      haptic(20)
      // navigation happens via the effect once member is applied
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      setError(msg)
      haptic(50)
      setBusy(false)
    }
  }

  // While checking existing session, show a calm spinner — not another form
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#F2F2F7]">
        <div className="h-10 w-10 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
      </div>
    )
  }

  // Already signed in — effect will redirect; keep spinner
  if (session) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#F2F2F7]">
        <div className="h-10 w-10 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center px-6 pb-10"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #E3EEFF 0%, #F2F2F7 60%)' }}
    >
      <div className="w-full max-w-[380px] page-enter">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 h-[72px] w-[72px] rounded-[22px] bg-gradient-to-br from-[#3395FF] to-[#0062CC] shadow-float flex items-center justify-center">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6h15l-1.6 8.2a2 2 0 0 1-2 1.6H8.2a2 2 0 0 1-2-1.6L4.4 3H2" />
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold text-[#1C1C1E] tracking-tight">StockFlow</h1>
          <p className="text-[15px] text-[#5F5F66] mt-1">Sign in with your email</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Email</label>
            <input
              className="field w-full"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Password</label>
            <input
              className="field w-full"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-[13px] text-[#E0333C] px-1">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="press w-full h-12 rounded-[14px] bg-[#007AFF] text-white font-semibold text-[16px] shadow-soft disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-3 text-[15px]">
          <Link to="/forgot-password" className="text-[#007AFF] font-medium">
            Forgot password?
          </Link>
          <p className="text-[#5F5F66]">
            New here?{' '}
            <Link to="/signup" className="text-[#007AFF] font-medium">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
