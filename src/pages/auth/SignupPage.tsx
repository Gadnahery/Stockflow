import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { haptic } from '../../lib/util'

export default function SignupPage() {
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
      if (needsVerification) {
        setDone(true)
      } else {
        navigate('/onboarding', { replace: true })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
      haptic(50)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-full flex items-center justify-center px-6 bg-[#F2F2F7]">
        <div className="max-w-[380px] text-center page-enter">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[#E8F8EE] flex items-center justify-center text-[#1E9E54] text-2xl">✓</div>
          <h1 className="text-[22px] font-semibold text-[#1C1C1E]">Check your email</h1>
          <p className="text-[15px] text-[#5F5F66] mt-2">
            We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then sign in.
          </p>
          <Link to="/login" className="inline-block mt-6 text-[#007AFF] font-medium">
            Back to sign in
          </Link>
        </div>
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
          <h1 className="text-[28px] font-bold text-[#1C1C1E] tracking-tight">Create account</h1>
          <p className="text-[15px] text-[#5F5F66] mt-1">Start your business on StockFlow</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Full name</label>
            <input
              className="field w-full"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Email</label>
            <input
              className="field w-full"
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <div className="flex gap-1 mt-2 px-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    strength >= i
                      ? strength === 1
                        ? 'bg-[#E0333C]'
                        : strength === 2
                          ? 'bg-[#C96A00]'
                          : 'bg-[#1E9E54]'
                      : 'bg-[#E6E6EB]'
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Confirm password</label>
            <input
              className="field w-full"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <p className="text-[13px] text-[#E0333C] px-1">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="press w-full h-12 rounded-[14px] bg-[#007AFF] text-white font-semibold text-[16px] shadow-soft disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-[15px] text-[#5F5F66]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#007AFF] font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
