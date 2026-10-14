import { Check, FlaskConical, ShieldCheck } from 'lucide-react'
import Screen from '../components/ui/Screen'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'

/** Billing is deliberately non-blocking while StockFlow is in beta. */
export default function BillingPage() {
  const { locale } = useI18n()
  const { business } = useAuth()
  const sw = locale === 'sw'

  const features = sw
    ? ['Mauzo ya POS bila kikomo', 'Bidhaa na usimamizi wa stoo', 'Historia ya mauzo na ripoti', 'Wateja, wauzaji na matumizi', 'Matawi na wafanyakazi', 'Matumizi bila mtandao na usawazishaji']
    : ['Unlimited POS sales', 'Products and inventory management', 'Sales history and reports', 'Customers, suppliers and expenses', 'Branches and team members', 'Offline use and data sync']

  return (
    <Screen title={sw ? 'Mpango na malipo' : 'Plan & billing'} subtitle={business?.name || 'StockFlow'}>
      <div className="mx-auto w-full max-w-2xl space-y-5 pb-10">
        <section className="rounded-[24px] border border-border bg-white p-6 shadow-card sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FlaskConical size={24} />
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {sw ? 'Ufikiaji wa beta umewezeshwa' : 'Beta access enabled'}
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {sw ? 'Vipengele vyote vimefunguliwa' : 'Everything is unlocked'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            {sw
              ? 'StockFlow bado iko kwenye majaribio. Kwa sasa huhitaji kulipa ili kutumia mauzo, stoo, ripoti au matawi. Hakuna malipo yatakayokatwa kupitia ukurasa huu.'
              : 'StockFlow is still in beta. You do not need to pay to use sales, inventory, reports, or branches. No payment will be requested from this page while beta access is enabled.'}
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-canvas/60 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={22} className="shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-ink">{sw ? 'Hakuna kizuizi cha malipo' : 'No payment restrictions'}</p>
                <p className="mt-0.5 text-xs leading-5 text-ink-secondary">
                  {sw ? 'Tarehe ya jaribio au hali ya malipo haitazuia shughuli zako wakati wa beta.' : 'Trial dates and payment status will not block your work during beta.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-white p-6 shadow-card sm:p-8">
          <h3 className="text-base font-bold text-ink">{sw ? 'Kinachopatikana wakati wa beta' : 'Included during beta'}</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                <Check size={17} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Screen>
  )
}
