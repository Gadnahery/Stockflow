import { Link } from 'react-router-dom'
import { AlertTriangle, Crown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { computeAccess } from '../lib/entitlement'

/** Soft banner: trial countdown or paywall (view-only). */
export default function SubscriptionBanner() {
  const { business } = useAuth()
  const access = computeAccess(business)

  if (access.level === 'unknown' || access.status === 'active') return null

  if (access.level === 'full' && access.trialDaysLeft != null && access.trialDaysLeft <= 3) {
    return (
      <div className="mx-3 mt-2 mb-0 rounded-[14px] bg-amber-50 border border-amber-200/80 px-3 py-2.5 flex items-start gap-2.5">
        <Crown size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-amber-900">
            {access.trialDaysLeft === 0
              ? 'Trial ends today'
              : `${access.trialDaysLeft} day${access.trialDaysLeft === 1 ? '' : 's'} left in trial`}
          </p>
          <p className="text-[12px] text-amber-800/90 mt-0.5">
            Subscribe for TZS 25,000 / month to keep full access.
          </p>
        </div>
        <Link
          to="/billing"
          className="press shrink-0 h-8 px-3 rounded-full bg-amber-600 text-white text-[12px] font-bold flex items-center"
        >
          Pay
        </Link>
      </div>
    )
  }

  if (access.level === 'readonly') {
    return (
      <div className="mx-3 mt-2 mb-0 rounded-[14px] bg-red-50 border border-red-200/80 px-3 py-2.5 flex items-start gap-2.5">
        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-red-900">View only — trial ended</p>
          <p className="text-[12px] text-red-800/90 mt-0.5">
            You can browse the app. Editing and sales are locked until you pay TZS 25,000 / month.
          </p>
        </div>
        <Link
          to="/billing"
          className="press shrink-0 h-8 px-3 rounded-full bg-red-600 text-white text-[12px] font-bold flex items-center"
        >
          Subscribe
        </Link>
      </div>
    )
  }

  return null
}
