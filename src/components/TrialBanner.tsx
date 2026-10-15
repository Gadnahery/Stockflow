import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { trialState, useSubscription } from '../lib/subscription'

const DISMISS_KEY = 'sf_trial_banner_dismissed'
const today = () => new Date().toISOString().slice(0, 10)

/** Slim, never-blocking countdown at the top of the app. Works offline from the saved copy. */
export default function TrialBanner() {
  const { business } = useAuth()
  const { t } = useI18n()
  const sub = useSubscription(business?.id)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === today() } catch { return false }
  })
  const state = trialState(sub)
  if (hidden || state.kind === 'none') return null

  const urgent = state.kind === 'trial' && state.daysLeft <= 2
  const text =
    state.kind === 'trial'
      ? `${t('trial.label')} · ${state.daysLeft === 1 ? t('trial.lastDay') : t('trial.days').replace('{n}', String(state.daysLeft))}`
      : state.kind === 'ended'
        ? t('trial.endedMsg')
        : t('trial.startMsg')

  return (
    <div
      role="status"
      data-testid="trial-banner"
      className={`flex items-center gap-2 px-3 py-2 text-[13px] font-semibold ${urgent ? 'bg-amber-100 text-warning' : state.kind === 'ended' ? 'bg-black/[0.06] text-ink-secondary' : 'bg-primary/10 text-primary'}`}
    >
      <Clock size={15} className="shrink-0" />
      <span className="flex-1 min-w-0 truncate">{text}</span>
      <Link to="/billing" className="shrink-0 underline underline-offset-2">
        {state.kind === 'not-started' ? t('trial.start') : t('trial.cta')}
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full"
        onClick={() => { try { localStorage.setItem(DISMISS_KEY, today()) } catch { /* ignore */ } setHidden(true) }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
