import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'

/**
 * Staff joins a shop via invite link.
 * 1) Not signed in → sign up or sign in, then return here with the same token
 * 2) Signed in → one tap joins the business (linked by accept_invite RPC)
 */
export default function AcceptInvitePage() {
  const { acceptInvite, session, loading } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenFromUrl = params.get('token') || ''
  const [token, setToken] = useState(tokenFromUrl)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl)
  }, [tokenFromUrl])

  // Auto-accept when already signed in with a token in the URL
  useEffect(() => {
    if (loading || !session || !tokenFromUrl || done || busy) return
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError('')
      try {
        await acceptInvite(tokenFromUrl.trim())
        if (!cancelled) {
          setDone(true)
          navigate('/pos', { replace: true })
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invalid or expired invite')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [loading, session, tokenFromUrl, acceptInvite, navigate, done, busy])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) {
      const next = `/accept-invite?token=${encodeURIComponent(token)}`
      navigate(`/signup?next=${encodeURIComponent(next)}`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await acceptInvite(token.trim())
      setDone(true)
      navigate('/pos', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid invite')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <AuthShell title="Join shop" subtitle="Checking your session…">
        <div className="flex justify-center py-8">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Join a shop"
      subtitle={
        session
          ? 'Accept the invite to start working in this business'
          : 'Create an account or sign in, then you will join the shop automatically'
      }
      footer={
        !session ? (
          <div className="space-y-2">
            <p>
              Already have an account?{' '}
              <Link
                to={`/login?next=${encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`)}`}
                className="auth-link"
              >
                Sign in
              </Link>
            </p>
          </div>
        ) : null
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!tokenFromUrl && (
          <div>
            <label className="auth-label" htmlFor="inv-token">Invite code</label>
            <input
              id="inv-token"
              className="field font-mono text-[14px]"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste invite code from your manager"
            />
          </div>
        )}
        {tokenFromUrl && (
          <p className="text-[13px] text-ink-secondary text-center">
            Invite ready. {session ? 'Joining your shop…' : 'Sign up or sign in to continue.'}
          </p>
        )}
        {error && <p className="text-[13px] text-danger text-center font-medium" role="alert">{error}</p>}
        <button type="submit" disabled={busy || (!token && !tokenFromUrl)} className="press auth-btn-primary">
          {busy
            ? 'Please wait…'
            : session
              ? 'Join shop'
              : 'Create account & join'}
        </button>
      </form>
    </AuthShell>
  )
}
