import { useI18n } from '../../i18n/I18nContext'
import { Link } from 'react-router-dom'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd, softwareJsonLd } from '../../lib/seo'

export default function FeaturesPage() {
  const { t, locale } = useI18n()
  const sw = locale === 'sw'

  const blocks = sw
    ? [
        { title: 'Uuzaji (POS)', body: 'Tafuta au skani bidhaa, rekebisha idadi, punguzo, malipo ya fedha, simu, kadi, benki au mkopo, na toa risiti.' },
        { title: 'Stoo', body: 'Fuatilia idadi, stoo ya chini, marekebisho, na historia ya harakati kutoka mauzo na mapokezi.' },
        { title: 'Historia ya mauzo', body: 'Angalia risiti, batilisha au rudisha mauzo kulingana na ruhusa, na stoo inarudi kiotomatiki.' },
        { title: 'Ripoti na faida', body: 'Mapato, gharama ya bidhaa, matumizi, faida ghafi na halisi — ili kutenganisha mauzo na faida.' },
        { title: 'Wateja na wasambazaji', body: 'Anwani za wateja na salio la mkopo; wasambazaji na mapokezi ya stoo.' },
        { title: 'Matumizi na zamu', body: 'Rekodi matumizi na fungua/funga till na float, mauzo ya fedha, na tofauti.' },
        { title: 'Timu, matawi na ruhusa', body: 'Alika wafanyakazi, majukumu, PIN, na tawi linalotumika kwa maduka yenye matawi.' },
        { title: 'Nje ya mtandao na sinki', body: 'Mauzo huhifadhiwa kwenye kifaa. Skrini ya Sinki inaonyesha nje ya sanduku; mtandaoni data inasinki.' },
        { title: 'Ingiza, hamisha na ukaguzi', body: 'CSV kwa bidhaa na wateja, zana za hamisha, na kumbukumbu ya mabadiliko muhimu.' },
      ]
    : [
        { title: 'Point of sale', body: 'Search or scan products, adjust quantities, apply discounts where permitted, take cash, mobile, card, bank or credit payments, and print or share receipts.' },
        { title: 'Inventory & stock ledger', body: 'Track quantities per product, low-stock thresholds, stock adjustments, and a history of movements tied to sales and receiving.' },
        { title: 'Sales history & refunds', body: 'Review receipts, void or refund completed sales when your role allows, and restore stock automatically on void or refund.' },
        { title: 'Reports & profit', body: 'Period filters for revenue, cost of goods, operating expenses, gross and net profit, and payment mix.' },
        { title: 'Customers & suppliers', body: 'Customer contacts and credit balances; supplier records and stock receiving for purchases.' },
        { title: 'Expenses & cash shifts', body: 'Log business expenses and open or close till sessions with opening float, cash sales, and variance.' },
        { title: 'Team, branches & permissions', body: 'Invite staff by email, assign roles, PIN lock on shared devices, and select active branch for multi-location shops.' },
        { title: 'Offline & sync', body: 'Sales and catalogue changes save on the device when offline. The Sync screen shows the outbox; when online, changes push and pull.' },
        { title: 'Import, export & audit', body: 'CSV import for products and customers, export tools, and an audit log for voids, discounts, price and stock changes.' },
      ]

  return (
    <>
      <Seo
        title={sw ? 'Vipengele — StockFlow' : 'Features — StockFlow'}
        description={
          sw
            ? 'POS, stoo, ripoti za faida, wateja, wasambazaji, matumizi, zamu, ruhusa, na sinki nje ya mtandao.'
            : 'POS, inventory, profit reports, customers, suppliers, expenses, shifts, permissions, and offline sync.'
        }
        path="/features"
        jsonLd={[softwareJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Features', path: '/features' }])]}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">
          {sw ? 'Bidhaa' : 'Product'}
        </p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight">
          {sw ? 'Kinachofanya kazi sasa' : 'What ships today'}
        </h1>
        <p className="mt-3 text-[16px] text-ink-secondary leading-relaxed">
          {sw
            ? 'Kila kipengele hapa kipo katika StockFlow. Hatutaji moduli za mgahawa, duka la dawa, au VFD hadi zishafanyiwa kazi.'
            : 'Every item below is in the current app. We do not list restaurant, pharmacy, or live VFD modules that are not shipped.'}
        </p>
        <div className="mt-10 space-y-4">
          {blocks.map((b) => (
            <article key={b.title} className="rounded-[18px] border border-border bg-white p-5 shadow-card">
              <h2 className="text-[17px] font-bold">{b.title}</h2>
              <p className="mt-2 text-[15px] text-ink-secondary leading-relaxed">{b.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/contact" className="press h-11 px-5 rounded-full bg-primary text-white font-semibold text-[14px]">
            {sw ? 'Omba onyesho' : 'Book a Demo'}
          </Link>
          <Link to="/pricing" className="press h-11 px-5 rounded-full border border-border font-semibold text-[14px]">
            {t('nav.pricing')}
          </Link>
        </div>
      </div>
    </>
  )
}
