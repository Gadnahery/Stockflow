import { Link } from 'react-router-dom'
import { Check, Crown, Users, Cloud, Shield, BarChart3, Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import Screen from '../components/ui/Screen'
import { useAuth } from '../contexts/AuthContext'
import { supabase, getBusinessId } from '../lib/supabase'

const FREE_SEATS = 10

const FEATURES = [
  { icon: Cloud, label: 'Offline-first POS & sync' },
  { icon: Users, label: `Up to ${FREE_SEATS} team members` },
  { icon: BarChart3, label: 'Sales, P&L and inventory reports' },
  { icon: Shield, label: 'Roles, PIN lock & audit log' },
  { icon: Crown, label: 'Products, customers, suppliers, GRN' },
  { icon: Headphones, label: 'Email support' },
]

export default function BillingPage() {
  const { business, member } = useAuth()
  const [seatCount, setSeatCount] = useState<number | null>(null)

  useEffect(() => {
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase) return
    void supabase
      .from('business_members')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', bizId)
      .eq('status', 'active')
      .then(({ count }) => setSeatCount(count ?? 0))
  }, [member?.business_id])

  const seats = seatCount ?? '—'
  const seatsLeft =
    typeof seatCount === 'number' ? Math.max(0, FREE_SEATS - seatCount) : null

  return (
    <Screen title="Plan & billing" subtitle={business?.name || 'Your workspace'}>
      <div className="space-y-5 md:max-w-lg pb-8">
        <div className="rounded-[22px] bg-gradient-to-br from-[#007AFF] to-[#0055CC] text-white p-6 shadow-float">
          <div className="flex items-center gap-2 text-[13px] font-semibold opacity-90">
            <Crown size={16} /> Current plan
          </div>
          <p className="text-[28px] font-bold tracking-tight mt-1">StockFlow Free</p>
          <p className="text-[14px] opacity-90 mt-1">
            Full POS for a single business — no card required.
          </p>
          <div className="mt-5 flex gap-4 text-[13px]">
            <div className="rounded-[14px] bg-white/15 px-3 py-2">
              <p className="opacity-80">Seats used</p>
              <p className="text-[18px] font-bold tabular-nums">
                {seats}
                <span className="text-[13px] font-medium opacity-80"> / {FREE_SEATS}</span>
              </p>
            </div>
            <div className="rounded-[14px] bg-white/15 px-3 py-2">
              <p className="opacity-80">Invites left</p>
              <p className="text-[18px] font-bold tabular-nums">{seatsLeft ?? '—'}</p>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-[22px] shadow-card p-5">
          <h2 className="text-[17px] font-bold mb-3">Included</h2>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-3 text-[14px]">
                <span className="h-8 w-8 rounded-full bg-emerald-50 text-success flex items-center justify-center shrink-0">
                  <Check size={16} strokeWidth={2.5} />
                </span>
                <span className="pt-1.5 font-medium text-ink">{f.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-[22px] shadow-card p-5">
          <h2 className="text-[17px] font-bold mb-1">Coming later</h2>
          <p className="text-[14px] text-ink-secondary mb-3">
            Paid plans will add multi-branch, extra seats, priority support, and white-label receipts.
            Your data stays yours.
          </p>
          <p className="text-[13px] text-ink-muted">
            No payment is collected in this build. Owners manage the team under{' '}
            <Link to="/users" className="text-primary font-semibold">
              Team
            </Link>
            .
          </p>
        </section>

        {(member?.role === 'owner' || member?.role === 'manager') && (
          <Link
            to="/users"
            className="press flex items-center justify-center gap-2 h-12 rounded-[14px] bg-primary text-white font-semibold"
          >
            <Users size={18} /> Manage team & invites
          </Link>
        )}
      </div>
    </Screen>
  )
}
