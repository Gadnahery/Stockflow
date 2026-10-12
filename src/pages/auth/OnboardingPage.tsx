import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, setDevicePin } from '../../contexts/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import { haptic } from '../../lib/util'

export default function OnboardingPage() {
  const { createBusiness, member, session, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    if (member) navigate('/', { replace: true })
  }, [loading, session, member, navigate])

  if (loading || !session || member) {
    return (
      <div className="auth-canvas min-h-full flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) {
      setError('Business name is required')
      return
    }
    if (pin.length < 4) {
      setError('Choose a 4–6 digit PIN for this device')
      return
    }
    setBusy(true)
    try {
      await createBusiness(name.trim(), phone.trim() || undefined, address.trim() || undefined)
      setDevicePin(pin)
      haptic(30)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create business')
      haptic(50)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Set up your store"
      subtitle="Takes less than a minute — then you’re ready to sell"
      footer={
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
          className="auth-link bg-transparent border-0 cursor-pointer text-[15px]"
        >
          Sign out
        </button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        <div>
          <label className="auth-label" htmlFor="ob-name">Business name</label>
          <input id="ob-name" className="field" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Store" />
        </div>
        <div>
          <label className="auth-label" htmlFor="ob-phone">Phone <span className="font-normal text-[#8E8E93]">(optional)</span></label>
          <input id="ob-phone" className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 …" />
        </div>
        <div>
          <label className="auth-label" htmlFor="ob-addr">Address <span className="font-normal text-[#8E8E93]">(optional)</span></label>
          <input id="ob-addr" className="field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dar es Salaam" />
        </div>
        <div>
          <label className="auth-label" htmlFor="ob-pin">Device unlock PIN</label>
          <input
            id="ob-pin"
            className="field tracking-[0.35em]"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
          />
          <p className="text-[12px] text-[#8E8E93] mt-1.5 leading-snug px-0.5">
            4–6 digits to unlock this device after idle. Your account still uses email &amp; password.
          </p>
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" disabled={busy} className="press auth-btn-primary">
          {busy ? 'Creating…' : 'Create business & continue'}
        </button>
      </form>
    </AuthShell>
  )
}
