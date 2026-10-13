import { useI18n } from '../../i18n/I18nContext'
import { Link } from 'react-router-dom'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'

export default function PricingPage() {
  const { t } = useI18n()
  return (
    <>
      <Seo
        title="Pricing — request a quote or start free"
        description="StockFlow pricing for retail shops in Tanzania. Request a quote, book a demo, or create an account to evaluate the product for your shop."
        path="/pricing"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }])}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">Pricing</p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight">Transparent next steps — no invented price list</h1>
        <p className="mt-3 text-[16px] text-ink-secondary leading-relaxed">
          Formal subscription packages are arranged per shop size and seats. We do not publish fake monthly fees.
          You can evaluate the product with your own account, or request pricing through a short conversation.
        </p>
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          <div className="rounded-[18px] border border-border bg-white p-6 shadow-card">
            <h2 className="text-[18px] font-bold">Try the product</h2>
            <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed">
              Create a business, add products, and run sales on phone or computer. Offline selling and sync are included in the app experience.
            </p>
            <Link to="/signup" className="press mt-5 inline-flex h-11 px-5 rounded-full bg-primary text-white font-semibold text-[14px]">
              Create account
            </Link>
          </div>
          <div className="rounded-[18px] border border-border bg-white p-6 shadow-card">
            <h2 className="text-[18px] font-bold">Request pricing</h2>
            <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed">
              Tell us your shop type, number of cashiers, and whether you need multiple branches. We reply with a clear quote and onboarding steps.
            </p>
            <Link to="/contact" className="press mt-5 inline-flex h-11 px-5 rounded-full bg-ink text-white font-semibold text-[14px]">
              Book a Demo
            </Link>
          </div>
        </div>
        <ul className="mt-8 space-y-2 text-[14px] text-ink-secondary">
          <li>• POS, inventory, reports, customers, suppliers, expenses, and shifts</li>
          <li>• Multi-user invites and role permissions</li>
          <li>• Offline sales with cloud sync when online</li>
          <li>• Installable on phone (PWA) and Windows desktop builds when packaged</li>
        </ul>
      </div>
    </>
  )
}
