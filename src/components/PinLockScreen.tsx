import { useState } from 'react'
import { Delete } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { haptic } from '../lib/util'

export default function PinLockScreen() {
  const { unlockWithPin, member, business, signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)

  const attempt = async (value: string) => {
    setBusy(true)
    const ok = await unlockWithPin(value)
    setBusy(false)
    if (ok) {
      haptic(25)
      setPin('')
      setError('')
    } else {
      haptic(60)
      setError('Incorrect PIN. Try again.')
      setShake((s) => s + 1)
      setPin('')
    }
  }

  const press = (digit: string) => {
    if (busy || pin.length >= 6) return
    haptic(8)
    setError('')
    const next = pin + digit
    setPin(next)
    if (next.length >= 4) void attempt(next)
  }

  const backspace = () => {
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  const name = member?.display_name || business?.name || 'StockFlow'

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center px-6 pb-8"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #E3EEFF 0%, #F2F2F7 60%)' }}
    >
      <div className="w-full max-w-[320px] page-enter">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-[20px] bg-gradient-to-br from-[#3395FF] to-[#0062CC] shadow-float flex items-center justify-center text-white text-2xl font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-[22px] font-semibold text-[#1C1C1E] tracking-tight">{name}</h1>
          <p className="text-[15px] text-[#5F5F66] mt-1">Enter PIN to unlock</p>
        </div>

        <div
          key={shake}
          className={`flex justify-center gap-3 mb-6 ${shake ? 'shake' : ''}`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-colors ${
                i < pin.length ? 'bg-[#007AFF]' : 'bg-[#E6E6EB]'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-[13px] text-[#E0333C] mb-4">{error}</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
            if (key === '') return <div key="empty" />
            if (key === 'del') {
              return (
                <button
                  key="del"
                  type="button"
                  onClick={backspace}
                  className="press h-14 rounded-2xl flex items-center justify-center text-[#1C1C1E]"
                  aria-label="Delete"
                >
                  <Delete size={22} strokeWidth={1.8} />
                </button>
              )
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className="press h-14 rounded-2xl bg-white/80 shadow-soft text-[24px] font-medium text-[#1C1C1E] tabular-nums"
              >
                {key}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-8 w-full text-center text-[15px] text-[#007AFF] font-medium"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
