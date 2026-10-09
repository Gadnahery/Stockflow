import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const user = await db.users.where('pin').equals(pin).first()
    if (user) {
      sessionStorage.setItem('currentUser', JSON.stringify(user))
      navigate('/')
    } else {
      setError('Invalid PIN')
      setPin('')
    }
  }

  const press = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit)
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">StockFlow</h1>
          <p className="mt-2 text-ink-secondary">Enter your PIN to continue</p>
        </div>

        <div className="bg-white rounded-card shadow-card p-6">
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-smooth ${
                  i < pin.length ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-danger text-sm mb-4">{error}</p>
          )}

          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                disabled={key === ''}
                onClick={() => {
                  if (key === '⌫') setPin((p) => p.slice(0, -1))
                  else if (key) press(key)
                }}
                className={`h-14 rounded-button text-xl font-medium transition-smooth
                  ${key === '' ? 'invisible' : 'bg-surface-secondary hover:bg-border active:scale-95 text-ink'}
                `}
              >
                {key}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={pin.length < 4}
            className="mt-6 w-full h-12 rounded-button bg-primary text-white font-medium
              disabled:opacity-40 hover:bg-primary-hover active:scale-[0.98] transition-smooth"
          >
            Unlock
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Demo PIN: <span className="font-medium">1234</span>
        </p>
      </div>
    </div>
  )
}
