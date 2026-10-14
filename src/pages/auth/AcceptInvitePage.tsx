import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import { supabase } from '../../lib/supabase'

/**
 * Staff joins a shop via invite link.
 * Fixes: do not put `busy` in effect deps (that caused infinite "Please wait…").
 * Fallback: if accept_invite RPC fails, try direct invite row + membership insert.
 */
export default function AcceptInvitePage() {
  const { acceptInvite, session, loading, member } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenFromUrl = params.get('token') || ''
  const [token, setToken] = useState(tokenFromUrl)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const tried = useRef(false)

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl)
  }, [tokenFromUrl])

  // Already a member of a shop → go in (invite already applied or owner)
  useEffect(() => {
    if (loading || !session || !member) return
    if (done) return
    setDone(true)
    navigate('/pos', { replace: true })
  }, [loading, session, member, done, navigate])

  const joinWithFallback = async (rawToken: string) => {
    const t = rawToken.trim()
    if (!t) throw new Error('Missing invite code')
    if (!supabase) throw new Error('Not configured')

    // 1) Preferred: server RPC
    try {
      await acceptInvite(t)
      return
    } catch (rpcErr) {
      // 2) Fallback: read invite + insert membership (needs RLS allow)
      const { data: inv, error: invErr } = await supabase
        .from('invites')
        .select('id, business_id, email, role, permissions, branch_ids, expires_at, accepted_at')
        .eq('token', t)
        .maybeSingle()

      if (invErr) throw rpcErr instanceof Error ? rpcErr : new Error(String(rpcErr))
      if (!inv) throw new Error('Invite not found or already used')
      if (inv.accepted_at) throw new Error('This invite was already accepted')
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        throw new Error('This invite has expired — ask the owner for a new one')
      }

      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) throw new Error('Sign in required')

      const email = (userData.user?.email || '').toLowerCase()
      if (inv.email && email && inv.email.toLowerCase() !== email) {
        throw new Error(`This invite is for ${inv.email}. Sign in with that email.`)
      }

      const { data: existing } = await supabase
        .from('business_members')
        .select('id, status')
        .eq('business_id', inv.business_id)
        .eq('user_id', uid)
        .maybeSingle()

      if (existing) {
        if (existing.status !== 'active') {
          await supabase.from('business_members').update({ status: 'active' }).eq('id', existing.id)
        }
      } else {
        const { error: memErr } = await supabase.from('business_members').insert({
          business_id: inv.business_id,
          user_id: uid,
          role: inv.role || 'cashier',
          permissions: inv.permissions || [],
          branch_ids: inv.branch_ids || [],
          status: 'active',
          display_name: userData.user?.user_metadata?.full_name || email.split('@')[0],
        })
        if (memErr) {
          throw new Error(
            memErr.message.includes('policy')
              ? 'Could not join: ask the owner to run the accept_invite function in Supabase, or create your account from Team → Create account.'
              : memErr.message,
          )
        }
      }

      await supabase
        .from('invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', inv.id)

      // Refresh membership in auth context
      await acceptInvite(t).catch(() => {
        // membership already written; reload page
        window.location.href = '/pos'
      })
    }
  }

  // Auto-join once when session + token are ready
  useEffect(() => {
    if (loading || !session || !tokenFromUrl || done || tried.current || member) return
    tried.current = true
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError('')
      try {
        await joinWithFallback(tokenFromUrl)
        if (!cancelled) {
          setDone(true)
          navigate('/pos', { replace: true })
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invalid or expired invite')
          setBusy(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, tokenFromUrl, member])

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
      await joinWithFallback(token)
      setDone(true)
      navigate('/pos', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid invite')
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
          <p>
            Already have an account?{' '}
            <Link
              to={`/login?next=${encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`)}`}
              className="auth-link"
            >
              Sign in
            </Link>
          </p>
        ) : (
          <p>
            <Link to="/onboarding" className="auth-link">
              Create your own shop instead
            </Link>
          </p>
        )
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!tokenFromUrl && (
          <div>
            <label className="auth-label" htmlFor="inv-token">
              Invite code
            </label>
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
        {tokenFromUrl && !error && (
          <p className="text-[13px] text-ink-secondary text-center">
            {busy
              ? 'Joining your shop…'
              : session
                ? 'Tap below if nothing happens'
                : 'Sign up or sign in to continue.'}
          </p>
        )}
        {error && (
          <div className="rounded-[14px] bg-red-50 px-3 py-2.5 text-[13px] text-danger text-center font-medium" role="alert">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || (!token && !tokenFromUrl)}
          className="press auth-btn-primary"
        >
          {busy ? 'Please wait…' : session ? 'Join shop' : 'Create account & join'}
        </button>
        {error && session && (
          <button
            type="button"
            className="press w-full h-11 rounded-[14px] text-[14px] font-semibold text-ink-secondary"
            onClick={() => {
              tried.current = false
              setError('')
              setBusy(false)
            }}
          >
            Try again
          </button>
        )}
      </form>
    </AuthShell>
  )
}
