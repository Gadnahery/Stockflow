import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

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
    <div className="min-h-full flex items-center justify-center px-6 bg-[#F2F2F7]">
      <div className="w-full max-w-[380px] page-enter">
        <h1 className="text-[28px] font-bold text-[#1C1C1E] text-center">Accept invite</h1>
        <p className="text-[15px] text-[#5F5F66] mt-2 text-center mb-8">
          Join the business you were invited to.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Invite token</label>
            <input className="field w-full" required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste invite code" />
          </div>
          {error && <p className="text-[13px] text-[#E0333C]">{error}</p>}
          <button type="submit" disabled={busy} className="press w-full h-12 rounded-[14px] bg-[#007AFF] text-white font-semibold disabled:opacity-60">
            {busy ? 'Joining…' : session ? 'Join business' : 'Sign in to continue'}
          </button>
          {!session && (
            <p className="text-center text-[15px]">
              <Link to="/signup" className="text-[#007AFF] font-medium">Create an account first</Link>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
