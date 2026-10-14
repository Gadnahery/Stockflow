import { Link } from 'react-router-dom'
import { Check, MessageCircle } from 'lucide-react'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'
import { useI18n } from '../../i18n/I18nContext'

/** Public pricing page intentionally avoids publishing a legacy plan or trial offer. */
export default function PricingPage() {
  const { locale } = useI18n()
  const sw = locale === 'sw'
  const features = sw
    ? ['Mauzo ya POS na risiti', 'Bidhaa, stoo na historia ya mauzo', 'Wateja, matumizi na ripoti', 'Wafanyakazi na matawi', 'Matumizi bila mtandao na usawazishaji']
    : ['POS sales and receipts', 'Products, inventory and sales history', 'Customers, expenses and reports', 'Team members and branches', 'Offline use and data synchronization']

  return (
    <>
      <Seo
        title={sw ? 'Bei — StockFlow' : 'Pricing — StockFlow'}
        description={sw ? 'Wasiliana na StockFlow kwa maelezo ya bei ya sasa.' : 'Contact StockFlow for current pricing information.'}
        path="/pricing"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }])}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">{sw ? 'Bei' : 'Pricing'}</p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight text-ink">
          {sw ? 'Bei wazi, kulingana na biashara yako.' : 'Pricing that fits your business.'}
        </h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-secondary">
          {sw
            ? 'Tunaboresha mfumo wetu wa mipango na malipo. Wasiliana nasi upate maelezo ya sasa; hakuna malipo yatakayohitajika ndani ya programu kwa sasa.'
            : 'We are rebuilding our plans and billing experience. Contact us for current pricing. The app will not request subscription payments while this is being prepared.'}
        </p>
        <section className="mt-8 rounded-[24px] border border-border bg-white p-6 shadow-card sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageCircle size={23} /></div>
          <h2 className="mt-4 text-xl font-bold text-ink">{sw ? 'StockFlow inakusaidia nini?' : 'What StockFlow helps you manage'}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-ink-secondary"><Check size={17} className="mt-0.5 shrink-0 text-primary" />{feature}</li>)}
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/contact" className="press inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white">{sw ? 'Wasiliana nasi kuhusu bei' : 'Contact us for pricing'}</Link>
            <Link to="/signup" className="press inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-ink">{sw ? 'Fungua akaunti' : 'Create account'}</Link>
          </div>
        </section>
      </div>
    </>
  )
}
