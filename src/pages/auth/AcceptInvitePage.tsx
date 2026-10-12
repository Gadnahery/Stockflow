import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'

export default function AcceptInvitePage() {
  const { acceptInvite, session } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenFromUrl = params.get('token') || ''
  const [token, setToken] = useState(tokenFromUrl)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) {
      navigate(`/login?next=/accept-invite?token=${encodeURIComponent(token)}`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await acceptInvite(token.trim())
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Join a business"
      subtitle="Accept your invite to start working"
      footer={
        !session ? (
          <p>
            Need an account?{' '}
            <Link to="/signup" className="auth-link">
              Sign up first
            </Link>
          </p>
        ) : null
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="auth-label" htmlFor="inv-token">Invite code</label>
          <input
            id="inv-token"
            className="field font-mono text-[14px]"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste invite token"
          />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="press auth-btn-primary">
          {busy ? 'Joining…' : session ? 'Join business' : 'Sign in to continue'}
        </button>
      </form>
    </AuthShell>
  )
}
