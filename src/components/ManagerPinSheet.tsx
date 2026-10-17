import { useState } from 'react'
import Sheet from './ui/Sheet'
import { haptic } from '../lib/util'
import { useI18n } from '../i18n/I18nContext'

/** Same hash as AuthContext device PIN (must stay in sync). */
function simpleHash(pin: string): string {
  let h = 0
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) | 0
  return `local:${h}`
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  onApproved: (approver: { id: string; name: string }) => void
}

/**
 * Manager override: device PIN proves an authorised person is present.
 * Offline-safe — no network. Records approver as the device owner label.
 */
export default function ManagerPinSheet({ open, onClose, title, subtitle, onApproved }: Props) {
  const { t, locale } = useI18n()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sw = locale === 'sw'
  const expected = (() => {
    try {
      return localStorage.getItem('sf_device_pin')
    } catch {
      return null
    }
  })()

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
    if (!expected) {
      setError(
        sw
          ? 'Weka PIN ya kifaa kwanza kwenye Mipangilio (akaunti ya mmiliki).'
          : 'Set a device PIN first in Settings (owner account).',
      )
      return
    }
    setBusy(true)
    const ok = expected === simpleHash(value)
    if (ok) {
      haptic(25)
      let name = 'Manager'
      try {
        const u = JSON.parse(sessionStorage.getItem('currentUser') || '{}') as { name?: string }
        name = u.name || name
      } catch {
        /* ignore */
      }
      try {
        const m = JSON.parse(localStorage.getItem('sf_member_cache') || 'null') as {
          display_name?: string
          user_id?: string
        } | null
        if (m?.display_name) name = m.display_name
        onApproved({ id: m?.user_id || 'manager-pin', name })
      } catch {
        onApproved({ id: 'manager-pin', name })
      }
      reset()
    } else {
      haptic(60)
      setError(sw ? 'PIN si sahihi' : 'Incorrect PIN')
      setPin('')
      setBusy(false)
    }
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
            ? 'Mfanyakazi hana ruhusa. Meneja aingize PIN ya kifaa kuidhinisha.'
            : 'This staff member is not allowed. A manager must enter the device PIN to approve.')}
      </p>
      {!expected && (
        <p className="text-[13px] text-danger mb-3" role="alert">
          {sw
            ? 'Hakuna PIN ya kifaa. Mmiliki aweke PIN kwenye Akaunti / Mipangilio.'
            : 'No device PIN set. Owner must set a PIN under Account / Settings.'}
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
              disabled={busy}
              onClick={() => {
                if (key === '⌫') {
                  setPin((p) => p.slice(0, -1))
                  setError('')
                } else press(key)
              }}
              className="press h-14 rounded-[16px] bg-black/[0.05] dark:bg-white/10 text-[22px] font-semibold text-ink"
            >
              {key}
            </button>
          ),
        )}
      </div>
      <p className="text-center text-[12px] text-ink-muted mt-4">
        {t('common.cancel') !== 'common.cancel' ? (
          <button type="button" className="text-primary font-semibold" onClick={close}>
            {sw ? 'Ghairi' : 'Cancel'}
          </button>
        ) : (
          <button type="button" className="text-primary font-semibold" onClick={close}>
            {sw ? 'Ghairi' : 'Cancel'}
          </button>
        )}
      </p>
    </Sheet>
  )
}
