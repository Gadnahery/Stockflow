import { Link } from 'react-router-dom'
import { Check, Crown, Loader2, Smartphone, Shield } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Screen from '../components/ui/Screen'
import { useAuth } from '../contexts/AuthContext'
import { supabase, getBusinessId } from '../lib/supabase'
import { useI18n } from '../i18n/I18nContext'
import { useUi } from '../store/uiStore'
import {
  MONTHLY_PRICE_TZS,
  collectMobilePayment,
  checkPaymentStatus,
  activateSubscription,
  normalizeTzPhone,
} from '../lib/harakapay'
import { computeAccess } from '../lib/entitlement'
import { fmt } from '../lib/util'
import { PLANS, type PlanId } from '../lib/plans'

type PayPhase = 'idle' | 'sending' | 'waiting' | 'success' | 'failed'

export default function BillingPage() {
  const { t, locale } = useI18n()
  const { business, member, session, refreshMembership } = useAuth()
  const toast = useUi((s) => s.toast)
  const [seatCount, setSeatCount] = useState<number | null>(null)
  const [phone, setPhone] = useState('')
  const [planId, setPlanId] = useState<PlanId>('starter')
  const [phase, setPhase] = useState<PayPhase>('idle')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sw = locale === 'sw'
  const access = computeAccess(business)

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

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPoll = (oid: string, bizId: string) => {
    stopPoll()
    let ticks = 0
    pollRef.current = setInterval(() => {
      void (async () => {
        ticks += 1
        if (ticks > 60) {
          stopPoll()
          setPhase('failed')
          setError(sw ? 'Muda umeisha. Angalia tena au jaribu tena.' : 'Timed out. Check status or try again.')
          return
        }
        try {
          const st = await checkPaymentStatus(oid)
          const status = st.payment?.status
          if (status === 'completed') {
            stopPoll()
            setPhase('success')
            const token = session?.access_token
            if (token) {
              const act = await activateSubscription({
                orderId: oid,
                businessId: bizId,
                accessToken: token,
              })
              if (act.success) {
                await refreshMembership()
                toast(sw ? 'Malipo yamefanikiwa — akaunti imefunguliwa' : 'Payment successful — account unlocked', 'success')
              }
            }
          } else if (status === 'failed') {
            stopPoll()
            setPhase('failed')
            setError(sw ? 'Malipo yameshindikana' : 'Payment failed')
          }
        } catch {
          /* keep polling */
        }
      })()
    }, 3000)
  }

  const onPay = async () => {
    setError('')
    const bizId = getBusinessId() || member?.business_id || business?.id
    if (!bizId) {
      setError(sw ? 'Hakuna biashara' : 'No business found')
      return
    }
    const p = phone.trim()
    if (p.replace(/\D/g, '').length < 9) {
      setError(sw ? 'Weka namba sahihi ya simu' : 'Enter a valid mobile number')
      return
    }
    setPhase('sending')
    try {
      const res = await collectMobilePayment({
        phone: p,
        amount: PLANS.find((p) => p.id === planId)?.priceTzs ?? MONTHLY_PRICE_TZS,
        businessId: bizId,
        description: 'StockFlow — 30 days subscription',
      })
      if (!res.success || !res.order_id) {
        setPhase('failed')
        setError(res.error || (sw ? 'Imeshindikana kutuma USSD' : 'Could not send USSD push'))
        return
      }
      setOrderId(res.order_id)
      // Record order client-side (RLS allows owner insert)
      if (supabase) {
        void supabase.from('payment_orders').upsert({
          order_id: res.order_id,
          business_id: bizId,
          user_id: session?.user?.id,
          amount: PLANS.find((p) => p.id === planId)?.priceTzs ?? MONTHLY_PRICE_TZS,
          status: 'pending',
          phone: normalizeTzPhone(p),
        })
      }
      setPhase('waiting')
      startPoll(res.order_id, bizId)
    } catch (e) {
      setPhase('failed')
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  const planLabel =
    access.status === 'active'
      ? sw
        ? 'Inatumika'
        : 'Active'
      : access.status === 'trial'
        ? sw
          ? 'Jaribio (siku 7)'
          : 'Trial (7 days)'
        : sw
          ? 'Imeisha — lipa kuendelea'
          : 'Expired — pay to continue'

  return (
    <Screen title={t('billing.title')} subtitle={business?.name || 'StockFlow'}>
      <div className="space-y-5 md:max-w-lg pb-10">
        {/* Current status */}
        <div className="rounded-[22px] bg-gradient-to-br from-[#007AFF] to-[#0055CC] text-white p-6 shadow-float">
          <div className="flex items-center gap-2 text-[13px] font-semibold opacity-90">
            <Crown size={16} /> {sw ? 'Mpango wa sasa' : 'Current plan'}
          </div>
          <p className="text-[26px] font-bold tracking-tight mt-1">{planLabel}</p>
          <p className="text-[14px] opacity-90 mt-1">
            {access.status === 'active' && access.paidUntil
              ? sw
                ? `Inatumika hadi ${new Date(access.paidUntil).toLocaleDateString()}`
                : `Active until ${new Date(access.paidUntil).toLocaleDateString()}`
              : access.trialDaysLeft != null && access.trialDaysLeft > 0
                ? sw
                  ? `Siku ${access.trialDaysLeft} zimebaki kwenye jaribio`
                  : `${access.trialDaysLeft} day(s) left in trial`
                : sw
                  ? 'Unaweza kuona data; uhariri umefungwa hadi ulipie.'
                  : 'You can view data; editing is locked until you subscribe.'}
          </p>
          <div className="mt-4 text-[13px] opacity-90">
            {sw ? 'Viti vya timu' : 'Team seats'}: {seatCount ?? '—'}
          </div>
        </div>

        
        {/* Plans */}
        <div className="space-y-3">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlanId(p.id)}
              className={`w-full text-left rounded-[18px] border p-4 ${
                planId === p.id ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-border bg-white'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-bold">{sw ? p.nameSw : p.name}</span>
                <span className="text-[16px] font-bold tabular-nums text-primary">
                  {fmt(p.priceTzs)} TZS
                  <span className="text-[12px] font-medium text-ink-muted">/{sw ? 'mwezi' : 'mo'}</span>
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ink-secondary">
                {(sw ? p.featuresSw : p.features).join(' · ')}
              </p>
            </button>
          ))}
        </div>

{/* Price */}
        <div className="rounded-[22px] border border-border bg-white p-6 shadow-card">
          <p className="text-[13px] font-semibold text-ink-secondary uppercase tracking-wide">
            {sw ? 'Bei' : 'Price'}
          </p>
          <p className="mt-1 text-[32px] font-bold tabular-nums tracking-tight">
            {fmt(MONTHLY_PRICE_TZS)}
            <span className="text-[16px] font-semibold text-ink-secondary"> TZS</span>
            <span className="text-[15px] font-medium text-ink-muted"> / {sw ? 'mwezi' : 'month'}</span>
          </p>
          <ul className="mt-4 space-y-2">
            {(sw
              ? ['POS na stoo', 'Ripoti za faida', 'Timu na matawi', 'Nje ya mtandao']
              : ['POS & stock', 'Profit reports', 'Team & branches', 'Offline selling']
            ).map((f) => (
              <li key={f} className="flex items-center gap-2 text-[14px]">
                <Check size={16} className="text-primary" strokeWidth={2.5} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile money pay */}
        <div className="rounded-[22px] border border-border bg-white p-6 shadow-card overflow-hidden relative">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone size={18} className="text-primary" />
            <h2 className="text-[17px] font-bold">
              {sw ? 'Lipa kwa simu (USSD)' : 'Pay by mobile (USSD push)'}
            </h2>
          </div>
          <p className="text-[13px] text-ink-secondary mb-4">
            {sw
              ? 'Weka namba yako. Utapata arifa ya USSD kuthibitisha. M-Pesa, Tigo, Airtel na wengine.'
              : 'Enter your number. You get a USSD prompt to confirm. Works across major TZ mobile money.'}
          </p>

          {phase === 'waiting' && (
            <div className="mb-5 rounded-[18px] bg-primary/5 border border-primary/15 p-5 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 relative">
                <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                <Smartphone size={28} className="text-primary relative z-10" />
              </div>
              <p className="text-[15px] font-semibold text-ink">
                {sw ? 'Angalia simu yako…' : 'Check your phone…'}
              </p>
              <p className="text-[13px] text-ink-secondary mt-1">
                {sw
                  ? 'Thibitisha malipo kwenye USSD. Tunangoja kiotomatiki.'
                  : 'Confirm the USSD prompt. We are waiting automatically.'}
              </p>
              {orderId && (
                <p className="mt-2 text-[11px] text-ink-muted font-mono">Order {orderId}</p>
              )}
              <div className="mt-4 flex justify-center">
                <Loader2 className="animate-spin text-primary" size={22} />
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div className="mb-5 rounded-[18px] bg-emerald-50 border border-emerald-200 p-5 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-3 text-2xl">
                ✓
              </div>
              <p className="text-[16px] font-bold text-emerald-900">
                {sw ? 'Malipo yamekamilika' : 'Payment complete'}
              </p>
              <p className="text-[13px] text-emerald-800 mt-1">
                {sw ? 'Akaunti yako imefunguliwa kwa siku 30.' : 'Your account is unlocked for 30 days.'}
              </p>
            </div>
          )}

          {phase === 'failed' && (
            <div className="mb-4 rounded-[14px] bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-800">
              {error || (sw ? 'Imeshindikana' : 'Failed')}
            </div>
          )}

          {phase !== 'success' && phase !== 'waiting' && (
            <>
              <label className="block text-[13px] font-semibold text-ink-secondary mb-1">
                {sw ? 'Namba ya simu' : 'Mobile number'}
              </label>
              <input
                className="field"
                inputMode="tel"
                placeholder="0712 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={phase === 'sending'}
              />
              {error && phase !== 'failed' && (
                <p className="mt-2 text-[13px] text-red-600">{error}</p>
              )}
              <button
                type="button"
                onClick={() => void onPay()}
                disabled={phase === 'sending'}
                className="press mt-4 w-full h-12 rounded-full bg-primary text-white font-semibold text-[15px] flex items-center justify-center gap-2"
              >
                {phase === 'sending' ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {sw ? 'Inatuma…' : 'Sending…'}
                  </>
                ) : (
                  <>
                    {sw ? 'Lipa' : 'Pay'} {fmt(PLANS.find((p) => p.id === planId)?.priceTzs ?? MONTHLY_PRICE_TZS)} TZS
                  </>
                )}
              </button>
            </>
          )}

          {phase === 'waiting' && (
            <button
              type="button"
              onClick={() => {
                stopPoll()
                setPhase('idle')
              }}
              className="w-full mt-2 h-10 text-[13px] font-semibold text-ink-secondary"
            >
              {sw ? 'Ghairi' : 'Cancel'}
            </button>
          )}

          <p className="mt-4 flex items-start gap-2 text-[11px] text-ink-muted leading-relaxed">
            <Shield size={14} className="shrink-0 mt-0.5" />
            {sw
              ? 'Malipo hufanywa kupitia HarakaPay. Funguo za API zinabaki kwenye seva — hazitumwi kwenye simu yako.'
              : 'Payments run through HarakaPay. API keys stay on the server — never in your browser.'}
          </p>
        </div>

        <p className="text-[13px] text-ink-muted text-center">
          <Link to="/contact" className="text-primary font-semibold">
            {sw ? 'Unahitaji msaada?' : 'Need help?'}
          </Link>
        </p>
      </div>
    </Screen>
  )
}
