import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ForgotPasswordPage() {
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
    <div className="min-h-full flex items-center justify-center px-6 bg-[#F2F2F7]">
      <div className="w-full max-w-[380px] page-enter">
        <h1 className="text-[28px] font-bold text-[#1C1C1E] tracking-tight text-center">Reset password</h1>
        <p className="text-[15px] text-[#5F5F66] mt-2 text-center mb-8">
          Enter your email and we&apos;ll send a reset link.
        </p>

        {sent ? (
          <div className="text-center">
            <p className="text-[15px] text-[#1C1C1E]">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </p>
            <Link to="/login" className="inline-block mt-6 text-[#007AFF] font-medium">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Email</label>
              <input
                className="field w-full"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-[13px] text-[#E0333C]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="press w-full h-12 rounded-[14px] bg-[#007AFF] text-white font-semibold disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-center">
              <Link to="/login" className="text-[#007AFF] font-medium text-[15px]">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
