import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, setDevicePin } from '../../contexts/AuthContext'
import { haptic } from '../../lib/util'

export default function OnboardingPage() {
  const { createBusiness, member, session } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!session) {
    navigate('/login', { replace: true })
    return null
  }
  if (member) {
    navigate('/', { replace: true })
    return null
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) {
      setError('Business name is required')
      return
    }
    if (pin.length < 4) {
      setError('Choose a 4–6 digit PIN for quick unlock')
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
    <div className="min-h-full flex items-center justify-center px-6 bg-[#F2F2F7]">
      <div className="w-full max-w-[400px] page-enter">
        <h1 className="text-[28px] font-bold text-[#1C1C1E] tracking-tight">Set up your business</h1>
        <p className="text-[15px] text-[#5F5F66] mt-2 mb-8">
          This creates your store, main branch, and owner account.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Business name</label>
            <input className="field w-full" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Store" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Phone (optional)</label>
            <input className="field w-full" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 …" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Address (optional)</label>
            <input className="field w-full" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dar es Salaam" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#5F5F66] mb-1.5 px-1">Device PIN (4–6 digits)</label>
            <input
              className="field w-full"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Used to unlock after idle"
            />
            <p className="text-[12px] text-[#76767D] mt-1 px-1">Not your account password — for quick re-entry on this device.</p>
          </div>

          {error && <p className="text-[13px] text-[#E0333C]">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="press w-full h-12 rounded-[14px] bg-[#007AFF] text-white font-semibold disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create business'}
          </button>
        </form>
      </div>
    </div>
  )
}
