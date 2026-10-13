import { useI18n } from '../../i18n/I18nContext'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'

export default function PricingPage() {
  const { t, locale } = useI18n()
  const sw = locale === 'sw'

  const plans = [
    {
      name: sw ? 'Anza' : 'Start',
      price: sw ? 'Bure kuanzisha' : 'Free to start',
      blurb: sw
        ? 'Fungua akaunti, ongeza bidhaa, uuze kwenye simu au kompyuta — ikiwa ni nje ya mtandao.'
        : 'Create an account, add products, and sell on phone or computer — including offline.',
      cta: sw ? 'Fungua akaunti' : 'Create account',
      to: '/signup',
      primary: true,
      points: sw
        ? ['POS na stoo', 'Ripoti za faida', 'Timu na PIN', 'Matawi mengi']
        : ['POS and stock', 'Profit reports', 'Team and PIN', 'Multi-branch'],
    },
    {
      name: sw ? 'Kukuza' : 'Grow',
      price: sw ? 'Bei kwa duka' : 'Priced per shop',
      blurb: sw
        ? 'Kwa maduka yenye wauzaji wengi au matawi. Tunakupa bei wazi baada ya mazungumzo mafupi.'
        : 'For shops with several cashiers or branches. Clear quote after a short conversation.',
      cta: sw ? 'Omba bei' : 'Request pricing',
      to: '/contact',
      primary: false,
      points: sw
        ? ['Viti vya ziada', 'Msaada wa kuanzisha', 'Mafunzo mafupi']
        : ['Extra seats', 'Onboarding help', 'Short training'],
    },
  ]

  const stories = [
    {
      who: sw ? 'Duka la vifaa · Dar' : 'Electronics shop · Dar',
      text: sw
        ? 'Tulihamia StockFlow kwa sababu ni rahisi. Mauzo yanaendelea hata mtandao ukikatika, na faida inaonekana wazi.'
        : 'We moved to StockFlow because it stays simple. Sales continue when the network drops, and profit is easy to read.',
    },
    {
      who: sw ? 'Minimarket · Arusha' : 'Minimarket · Arusha',
      text: sw
        ? 'Wafanyakazi walijifunza POS kwa dakika chache. Mimi ninaona stoo na matumizi bila kelele za ERP.'
        : 'Staff learned the POS in minutes. I see stock and expenses without ERP noise.',
    },
  ]

  return (
    <>
      <Seo
        title={sw ? 'Bei — StockFlow' : 'Pricing — StockFlow'}
        description={
          sw
            ? 'Bei wazi za StockFlow kwa maduka Tanzania. Anza bure au omba bei kwa duka lako.'
            : 'Clear StockFlow pricing for retail shops in Tanzania. Start free or request a quote for your shop.'
        }
        path="/pricing"
        jsonLd={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
        ])}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">
          {t('mkt.pricing.title')}
        </p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight text-ink">
          {sw ? 'Bei rahisi. Hatua wazi.' : 'Simple pricing. Clear next steps.'}
        </h1>
        <p className="mt-3 text-[16px] text-ink-secondary leading-relaxed max-w-xl">
          {sw
            ? 'Anza bila malipo ya kuanza. Unapokua, unazungumza nasi kwa bei ya duka lako — sio orodha ya bei bandia.'
            : 'Start at no cost. When you grow, we quote for your shop size — not a fake public price list.'}
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-[22px] border bg-white p-6 shadow-card flex flex-col ${
                p.primary ? 'border-primary/30 ring-1 ring-primary/15' : 'border-border'
              }`}
            >
              <h2 className="text-[18px] font-bold">{p.name}</h2>
              <p className="mt-1 text-[15px] font-semibold text-primary">{p.price}</p>
              <p className="mt-3 text-[14px] text-ink-secondary leading-relaxed flex-1">{p.blurb}</p>
              <ul className="mt-4 space-y-2">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2 text-[14px] text-ink">
                    <Check size={16} className="text-primary shrink-0" strokeWidth={2.5} />
                    {pt}
                  </li>
                ))}
              </ul>
              <Link
                to={p.to}
                className={`press mt-6 inline-flex h-11 items-center justify-center px-5 rounded-full font-semibold text-[14px] ${
                  p.primary ? 'bg-primary text-white' : 'border border-border text-ink'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-[20px] font-bold tracking-tight">
            {sw ? 'Maduka yanayosema' : 'What shops say'}
          </h2>
          <div className="mt-5 space-y-4">
            {stories.map((s) => (
              <blockquote
                key={s.who}
                className="rounded-[18px] border border-border bg-white p-5 shadow-card"
              >
                <p className="text-[15px] text-ink leading-relaxed">“{s.text}”</p>
                <footer className="mt-3 text-[13px] font-semibold text-ink-secondary">{s.who}</footer>
              </blockquote>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-ink-muted">
            {sw
              ? 'Hadithi hizi zinaonyesha matumizi ya kawaida. Omba onyesho kwa duka lako.'
              : 'These reflect typical use. Book a demo for your own shop.'}
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/contact"
            className="press h-11 px-5 rounded-full bg-primary text-white font-semibold text-[14px]"
          >
            {sw ? 'Omba onyesho' : 'Book a demo'}
          </Link>
          <Link
            to="/features"
            className="press h-11 px-5 rounded-full border border-border font-semibold text-[14px]"
          >
            {sw ? 'Vipengele' : 'Features'}
          </Link>
        </div>
      </div>
    </>
  )
}
