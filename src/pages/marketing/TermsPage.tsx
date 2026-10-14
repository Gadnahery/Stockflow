import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Terms of Service"
        description="Terms for using the StockFlow website and retail POS application."
        path="/terms"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Terms', path: '/terms' }])}
      />
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-[30px] font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-[14px] text-ink-muted">Last updated: 13 October 2026</p>
        <div className="mt-6 space-y-4 text-[15px] text-ink-secondary leading-relaxed">
          <p>
            By using StockFlow you agree to use the service lawfully, keep login credentials confidential, and ensure that
            staff you invite follow these terms.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Service</h2>
          <p>
            StockFlow provides software for recording sales, inventory, and related business records. Availability may
            depend on network connectivity for cloud features; offline device storage covers supported local workflows.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Your data</h2>
          <p>
            You remain responsible for the accuracy of products, prices, tax settings, and transactions you enter.
            You should export critical records regularly for your own backup practices.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Acceptable use</h2>
          <p>
            Do not attempt to access another business’s data, disrupt the service, or misuse invitations and permissions.
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Liability</h2>
          <p>
            The software is provided as a business tool. You are responsible for verifying totals, stock counts, and
            compliance obligations that apply to your jurisdiction (including any fiscal device rules not yet integrated).
          </p>
          <h2 className="text-[18px] font-bold text-ink pt-2">Changes</h2>
          <p>
            We may update these terms. Continued use after notice constitutes acceptance of the revised terms where permitted by law.
          </p>
        </div>
      </article>
    </>
  )
}
