import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'

export default function PrivacyPage() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="How StockFlow handles account data, business records, and device storage for the POS application."
        path="/privacy"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Privacy', path: '/privacy' }])}
      />
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16 prose-like">
        <h1 className="text-[30px] font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-[14px] text-ink-muted">Last updated: 13 October 2026</p>
        <div className="mt-6 space-y-4 text-[15px] text-ink-secondary leading-relaxed">
          <p>
            StockFlow provides point-of-sale and inventory software. This policy describes how we handle information
            when you use the website and the application.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Account information</h2>
          <p>
            When you create an account we process email and authentication credentials through our authentication provider.
            Business name, staff memberships, and role settings are stored so you can access your shop workspace.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Business records</h2>
          <p>
            Product catalogues, sales, customers, suppliers, stock movements, expenses, and related records belong to your
            business. Access is restricted by membership and row-level security so other shops cannot read your data.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Device storage</h2>
          <p>
            To support offline sales, the application stores operational data on the device (for example IndexedDB).
            You can clear local data from the Sync screen. Clearing local data does not delete cloud records for your business.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Contact forms</h2>
          <p>
            Demo and contact submissions include the details you provide so we can respond. We do not sell these leads.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Cookies and analytics</h2>
          <p>
            Essential cookies or local storage may be used for sign-in sessions and preferences. If analytics is enabled
            later, it should be disclosed here and configured with appropriate consent where required.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Contact</h2>
          <p>
            Privacy questions can be sent through the <a className="text-primary font-semibold" href="/contact">contact page</a>.
          </p>
        </div>
      </article>
    </>
  )
}
