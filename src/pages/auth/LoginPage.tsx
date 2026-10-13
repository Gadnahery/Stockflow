import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import { haptic } from '../../lib/util'
import { useI18n } from '../../i18n/I18nContext'

function Spinner() {
  return (
    <div className="auth-canvas min-h-full flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
    </div>
  )
}

export default function LoginPage() {
  const { signIn, session, member, loading } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/pos'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Existing session → leave login
  useEffect(() => {
    if (loading || busy) return
    if (!session) return
    navigate(member ? (from.startsWith('/login') || from === '/' ? '/pos' : from) : '/onboarding', { replace: true })
  }, [loading, session, member, from, navigate, busy])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { hasBusiness } = await signIn(email.trim(), password)
      haptic(20)
      if (hasBusiness) {
        const dest = from.startsWith('/login') || from === '/' ? '/pos' : from
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
      title={t('auth.welcome')}
      subtitle={t('auth.subtitle')}
      footer={
        <>
          <p>
            <Link to="/forgot-password" className="auth-link">{t('auth.forgot')}</Link>
          </p>
          <p>
            {t('auth.new')}{' '}
            <Link to="/signup" className="auth-link">{t('auth.create')}</Link>
          </p>
        </>
      }
    >
      <div className="flex justify-end mb-3">
        <button type="button" className="text-[13px] font-bold text-primary px-3 py-1.5 rounded-full bg-primary/10" onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}>
          {locale === 'en' ? 'Kiswahili' : 'English'}
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="auth-label" htmlFor="login-email">{t('auth.email')}</label>
          <input id="login-email" className="field" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
        </div>
        <div>
          <label className="auth-label" htmlFor="login-password">{t('auth.password')}</label>
          <input id="login-password" className="field" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="press auth-btn-primary">
          {busy ? t('auth.signingIn') : t('auth.signin')}
        </button>
      </form>
    </AuthShell>
  )
}
