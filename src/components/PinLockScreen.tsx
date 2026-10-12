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
      setError('Incorrect PIN')
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

  const name = member?.display_name || business?.name || 'StockFlow'

  return (
    <div className="auth-canvas min-h-full flex flex-col items-center justify-center px-6 pb-10">
      <div className="auth-blob auth-blob-a" aria-hidden />
      <div className="auth-blob auth-blob-b" aria-hidden />

      <div className="relative w-full max-w-[320px] page-enter">
        <div className="text-center mb-8">
          <div className="auth-logo mx-auto mb-4 text-white text-[26px] font-semibold tracking-tight">
            {name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-[22px] font-semibold text-[#1C1C1E] tracking-tight">{name}</h1>
          <p className="text-[15px] text-[#636366] mt-1">Enter PIN to unlock</p>
        </div>

        <div key={shake} className={`flex justify-center gap-3.5 mb-5 ${shake ? 'shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? 'bg-[#007AFF] scale-110 shadow-[0_0_0_4px_rgba(0,122,255,0.2)]'
                  : 'bg-[#D1D1D6]'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-[13px] text-[#E0333C] font-medium mb-4">{error}</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
            if (key === '') return <div key="empty" />
            if (key === 'del') {
              return (
                <button
                  key="del"
                  type="button"
                  onClick={() => {
                    setPin((p) => p.slice(0, -1))
                    setError('')
                  }}
                  className="press h-[62px] rounded-[18px] flex items-center justify-center text-[#1C1C1E] bg-white/50"
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
                className="press h-[62px] rounded-[18px] bg-white/85 shadow-soft text-[26px] font-medium text-[#1C1C1E] tabular-nums"
              >
                {key}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-9 w-full text-center text-[15px] text-[#007AFF] font-semibold"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
