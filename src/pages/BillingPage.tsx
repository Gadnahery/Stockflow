import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, CreditCard, RefreshCw, ShieldCheck } from 'lucide-react'
import Screen from '../components/ui/Screen'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n/I18nContext'

type BillingPlan = {
  id: string
  code: string
  name: string
  description: string | null
  amount_tzs: number
  interval: 'month' | 'year'
  features: string[]
  max_branches?: number
  max_accounts?: number
  extra_branch_price_tzs?: number
}
type Invoice = {
  id: string
  invoice_number: string
  amount_tzs: number
  status: string
  issued_at: string
  paid_at: string | null
}
type Subscription = {
  status: string
  current_period_end: string | null
  trial_ends_at: string | null
  plan: { name: string } | null
}

const money = (value: number) => new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(value)
const date = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—'

export default function BillingPage() {
  const { t } = useI18n()

  const { business, session, member } = useAuth()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [phone, setPhone] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [attemptId, setAttemptId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const canManage = ['owner', 'business_owner', 'admin', 'platform_admin'].includes(String(member?.role))

  const load = useCallback(async () => {
    if (!supabase || !business?.id) { setLoading(false); return }
    setLoading(true)
    const [planRes, invoiceRes, subRes] = await Promise.all([
      supabase.from('billing_plans').select('id, code, name, description, amount_tzs, interval, features, max_branches, max_accounts, extra_branch_price_tzs').eq('is_active', true).order('amount_tzs'),
      supabase.from('billing_invoices').select('id, invoice_number, amount_tzs, status, issued_at, paid_at').eq('business_id', business.id).order('issued_at', { ascending: false }).limit(10),
      supabase.from('business_subscriptions').select('status, current_period_end, trial_ends_at, plan:billing_plans(name)').eq('business_id', business.id).maybeSingle(),
    ])
    if (planRes.error || invoiceRes.error || subRes.error) {
      setError('Billing records could not be loaded. Confirm the Billing v2 database migration has been applied.')
    } else {
      const nextPlans = (planRes.data || []) as BillingPlan[]
      setPlans(nextPlans)
      setInvoices((invoiceRes.data || []) as Invoice[])
      setSubscription((subRes.data || null) as unknown as Subscription | null)
      if (!selectedPlan && nextPlans[0]) setSelectedPlan(nextPlans[0].code)
    }
    setLoading(false)
  }, [business?.id, selectedPlan])

  useEffect(() => { void load() }, [load])

  const startTrial = async () => {
    if (!business?.id || !session?.access_token) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/billing/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ business_id: business.id }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not start trial')
      setNotice(data.message)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start trial')
    } finally { setBusy(false) }
  }

  const startPayment = async () => {
    if (!business?.id || !session?.access_token || !selectedPlan) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ business_id: business.id, plan_code: selectedPlan, phone }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not start payment')
      setAttemptId(data.attempt_id)
      setNotice(data.message + '. Invoice ' + data.invoice_number + ' for ' + money(data.amount_tzs) + '.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment')
    } finally { setBusy(false) }
  }

  const checkStatus = async () => {
    if (!attemptId || !session?.access_token) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/billing/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ attempt_id: attemptId }),
      })
      const data = await response.json()
      if (!response.ok || (!data.success && data.status !== 'pending')) throw new Error(data.error || 'Could not check payment')
      setNotice(data.status === 'paid' ? 'Payment confirmed. Your billing record is updated.' : data.message || 'Payment is still pending.')
      if (data.status === 'paid') setAttemptId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check payment')
    } finally { setBusy(false) }
  }

  return (
    <Screen title="Billing" subtitle={business?.name || 'Manage invoices and plan'}>
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-10">
        <section className="rounded-[24px] border border-border bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck size={22} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-ink">{subscription?.plan?.name || 'Billing account'}</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                {subscription?.status === 'active'
                  ? 'Active plan · current period ends ' + date(subscription.current_period_end)
                  : subscription?.status === 'trialing'
                    ? (subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > Date.now()
                      ? '7-day trial · ends ' + date(subscription.trial_ends_at)
                      : 'Trial period ended · choose a plan when ready')
                    : 'Your workspace remains available. Billing status does not lock sales, stock, reports, or other business operations.'}
              </p>
            </div>
            <button type="button" onClick={() => void load()} className="press inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-ink-secondary" aria-label="Refresh billing"><RefreshCw size={16} /></button>
          </div>
        </section>

        {!loading && !subscription && canManage && (
          <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-ink">{t('billing.tryFree')}</h3>
              <p className="mt-1 text-sm text-ink-secondary">Seven days free. After the trial you can still sign in and view data, but selling and editing stay locked until you pay.</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void startTrial()} className="press inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Please wait…' : 'Start free trial'}</button>
          </section>
        )}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <section className="rounded-[24px] border border-border bg-white p-6 shadow-card sm:p-8">
          <h3 className="text-base font-bold text-ink">{t('billing.plans')}</h3>
          <p className="mt-1 text-sm text-ink-secondary">Prices and features are managed centrally. No price is hard-coded into the app.</p>
          {loading ? <p className="mt-5 text-sm text-ink-secondary">{t('billing.loadingPlans')}</p> : plans.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border p-5">
              <p className="font-semibold text-ink">{t('billing.plansConfiguring')}</p>
              <p className="mt-1 text-sm leading-6 text-ink-secondary">No plan is available to purchase yet. You can keep using StockFlow; billing will not block business operations.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {plans.map(plan => (
                <label key={plan.id} className={'block cursor-pointer rounded-2xl border p-5 transition-colors ' + (selectedPlan === plan.code ? 'border-primary ring-1 ring-primary/20' : 'border-border')}>
                  <span className="flex items-start justify-between gap-3">
                    <span><span className="block font-bold text-ink">{plan.name}</span><span className="mt-1 block text-sm text-ink-secondary">{plan.description || 'StockFlow business plan'}</span></span>
                    <input type="radio" name="billing-plan" value={plan.code} checked={selectedPlan === plan.code} onChange={() => setSelectedPlan(plan.code)} />
                  </span>
                  <span className="mt-4 block text-xl font-bold text-ink">{money(Number(plan.amount_tzs))}<span className="ml-1 text-sm font-medium text-ink-muted">/ {plan.interval}</span></span>
                  {Array.isArray(plan.features) && plan.features.length > 0 && <ul className="mt-4 space-y-2">{plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm text-ink-secondary"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />{feature}</li>)}</ul>}
                  <p className="mt-3 text-xs text-ink-muted">
                    Up to {plan.max_branches ?? (plan.code === 'starter' ? 1 : plan.code === 'growth' ? 3 : 5)} branches ·{' '}
                    {plan.max_accounts ?? (plan.code === 'starter' ? 4 : plan.code === 'growth' ? 12 : 15)} accounts
                    {(plan.extra_branch_price_tzs || 0) > 0 ? ` · +${Number(plan.extra_branch_price_tzs).toLocaleString()} TZS / extra branch` : ''}
                  </p>
                </label>
              ))}
            </div>
          )}
          {canManage && plans.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="Tanzanian mobile number (e.g. 07XXXXXXXX)" className="h-11 rounded-xl border border-border px-3 text-sm outline-none focus:border-primary" />
              <button type="button" disabled={busy || !selectedPlan || !phone.trim()} onClick={() => void startPayment()} className="press inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={17} />{busy ? 'Please wait…' : 'Request payment'}</button>
            </div>
          )}
          {attemptId && <button type="button" disabled={busy} onClick={() => void checkStatus()} className="press mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-ink disabled:opacity-50"><Clock3 size={16} />{t('billing.checkPay')}</button>}
          {!canManage && <p className="mt-4 text-xs text-ink-muted">Only the business owner or an administrator can initiate billing payments.</p>}
        </section>

        <section className="rounded-[24px] border border-border bg-white p-6 shadow-card sm:p-8">
          <h3 className="text-base font-bold text-ink">{t('billing.invoices')}</h3>
          {invoices.length === 0 ? <p className="mt-3 text-sm text-ink-secondary">{t('billing.noInvoices')}</p> : (
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-ink-muted"><th className="pb-3 font-semibold">Invoice</th><th className="pb-3 font-semibold">Date</th><th className="pb-3 font-semibold">Amount</th><th className="pb-3 font-semibold">Status</th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id} className="border-b border-border last:border-0"><td className="py-3 font-medium text-ink">{invoice.invoice_number}</td><td className="py-3 text-ink-secondary">{date(invoice.issued_at)}</td><td className="py-3 text-ink">{money(Number(invoice.amount_tzs))}</td><td className="py-3 capitalize text-ink-secondary">{invoice.status}</td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </Screen>
  )
}
