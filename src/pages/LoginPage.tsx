import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete } from 'lucide-react'
import { db } from '../lib/db'
import { haptic } from '../lib/util'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const navigate = useNavigate()

  const attempt = async (value: string, final: boolean) => {
    const user = await db.users.where('pin').equals(value).first()
    if (user && user.active !== false) {
      haptic(25)
      sessionStorage.setItem('currentUser', JSON.stringify(user))
      navigate('/')
    } else if (final) {
      haptic(60)
      setError('That PIN is not right. Try again.')
      setShake((s) => s + 1)
      setPin('')
    }
  }

  const press = (digit: string) => {
    if (pin.length >= 6) return
    haptic(8)
    setError('')
    const next = pin + digit
    setPin(next)
    // unlock as soon as the PIN matches; only complain at 6 digits or on Unlock
    if (next.length >= 4) attempt(next, next.length === 6)
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 pb-8" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #E3EEFF 0%, #F2F2F7 60%)' }}>
      <div className="w-full max-w-[320px] page-enter">
        <div className="text-center mb-9">
          <div className="mx-auto mb-5 h-[72px] w-[72px] rounded-[22px] bg-gradient-to-br from-[#3395FF] to-[#0062CC] shadow-float flex items-center justify-center">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6h15l-1.6 8.2a2 2 0 0 1-2 1.6H8.2a2 2 0 0 1-2-1.6L4.4 3H2" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></svg>
          </div>
          <h1 className="text-[30px] font-bold tracking-tight">StockFlow</h1>
          <p className="mt-1.5 text-[16px] text-ink-secondary">{error ? <span className="text-danger font-medium">{error}</span> : 'Enter your PIN'}</p>
        </div>

        <div key={shake} className={`flex justify-center gap-4 mb-10 ${shake ? 'shake' : ''}`} aria-label={`${pin.length} digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-[1.5px] transition-all duration-200 ${i < pin.length ? 'bg-ink border-ink scale-110' : 'border-ink/30'}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-x-5 gap-y-4 justify-items-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} onClick={() => press(k)} className="press h-[76px] w-[76px] rounded-full glass shadow-soft border border-white/70 text-[30px] font-medium">{k}</button>
          ))}
          <span />
          <button onClick={() => press('0')} className="press h-[76px] w-[76px] rounded-full glass shadow-soft border border-white/70 text-[30px] font-medium">0</button>
          <button onClick={() => { haptic(8); setPin((p) => p.slice(0, -1)) }} aria-label="Delete" className="press h-[76px] w-[76px] rounded-full text-ink-secondary flex items-center justify-center">
            <Delete size={26} />
          </button>
        </div>

        <button
          onClick={() => attempt(pin, true)}
          disabled={pin.length < 4}
          className="press mt-8 w-full h-[52px] rounded-[16px] bg-primary text-white text-[17px] font-bold disabled:opacity-0 transition-opacity"
        >
          Unlock
        </button>
        <p className="mt-5 text-center text-[13px] text-ink-muted">Demo PIN: <span className="font-semibold">1234</span></p>
      </div>
    </div>
  )
}
