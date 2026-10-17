import { useState } from 'react'
import Sheet from './ui/Sheet'
import { haptic } from '../lib/util'
import { useI18n } from '../i18n/I18nContext'
import { hasAnyApprovalPin, matchApprovalPin } from '../lib/approvalPin'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  onApproved: (approver: { id: string; name: string }) => void
}

/**
 * Manager override: requires a personal approval PIN set for owners/managers
 * in Users — NOT the device unlock PIN cashiers use to open the app.
 */
export default function ManagerPinSheet({ open, onClose, title, subtitle, onApproved }: Props) {
  const { locale } = useI18n()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sw = locale === 'sw'
  const configured = hasAnyApprovalPin()

  const reset = () => {
    setPin('')
    setError('')
    setBusy(false)
  }

  const close = () => {
    reset()
    onClose()
  }

  const attempt = (value: string) => {
    if (!configured) {
      setError(
        sw
          ? 'Hakuna PIN ya idhini. Mmiliki aweke PIN ya idhini kwenye Timu / Watumiaji.'
          : 'No approval PIN set. Owner must set manager approval PINs under Team / Users.',
      )
      return
    }
    setBusy(true)
    const match = matchApprovalPin(value)
    if (match) {
      haptic(25)
      onApproved({ id: match.memberId, name: match.name })
      close()
      return
    }
    haptic(40)
    setError(sw ? 'PIN si sahihi' : 'Wrong approval PIN')
    setPin('')
    setBusy(false)
  }

  const press = (digit: string) => {
    if (busy || pin.length >= 6) return
    haptic(8)
    setError('')
    const next = pin + digit
    setPin(next)
    if (next.length >= 4) attempt(next)
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <p className="text-[14px] text-ink-secondary mb-4">
        {subtitle ||
          (sw
            ? 'Mfanyakazi hana ruhusa. Meneja aingize PIN yake ya idhini (si PIN ya kufungua programu).'
            : 'This staff member is not allowed. A manager must enter their approval PIN (not the app unlock PIN).')}
      </p>
      {!configured && (
        <p className="text-[13px] text-danger mb-3" role="alert">
          {sw
            ? 'Hakuna PIN ya idhini iliyowekwa. Mmiliki: Timu → chagua meneja → weka PIN ya idhini.'
            : 'No approval PINs configured. Owner: Team → select a manager → set Approval PIN.'}
        </p>
      )}
      <div className="flex justify-center gap-2.5 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 ${
              i < pin.length ? 'bg-primary border-primary' : 'border-ink-muted/40'
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="text-center text-[13px] text-danger font-medium mb-3" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) =>
          key === '' ? (
            <span key="sp" />
          ) : (
            <button
              key={key}
              type="button"
              disabled={busy || !configured}
              onClick={() => {
                if (key === '⌫') {
                  setPin((p) => p.slice(0, -1))
                  setError('')
                } else press(key)
              }}
              className="press h-14 rounded-[16px] bg-black/[0.05] dark:bg-white/10 text-[22px] font-semibold text-ink disabled:opacity-40"
            >
              {key}
            </button>
          ),
        )}
      </div>
      <p className="text-center text-[12px] text-ink-muted mt-4">
        <button type="button" className="text-primary font-semibold" onClick={close}>
          {sw ? 'Ghairi' : 'Cancel'}
        </button>
      </p>
    </Sheet>
  )
}
