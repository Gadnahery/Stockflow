import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'

/** Sticky bar when trial ended / unpaid — view OK, write blocked. */
export default function ReadOnlyBanner() {
  const { canWrite, access } = useAuth()
  const { locale } = useI18n()
  if (canWrite || access.level !== 'readonly') return null
  const sw = locale === 'sw'
  return (
    <div
      role="alert"
      data-testid="readonly-banner"
      className="flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold bg-amber-100 text-amber-950 border-b border-amber-200/80"
    >
      <Lock size={15} className="shrink-0" />
      <span className="flex-1 min-w-0">
        {sw
          ? 'Jaribio limeisha — unaweza kuona tu. Lipia ili uuze na uhariri tena.'
          : access.message || 'Trial ended — view only. Pay to sell and edit again.'}
      </span>
      <Link
        to="/billing"
        className="shrink-0 underline underline-offset-2 font-bold"
      >
        {sw ? 'Lipia' : 'Billing'}
      </Link>
    </div>
  )
}
