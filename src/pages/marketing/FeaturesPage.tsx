import { Link } from 'react-router-dom'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd, softwareJsonLd } from '../../lib/seo'

const blocks = [
  { title: 'Point of sale', body: 'Search or scan products, adjust quantities, apply discounts where permitted, take cash, mobile, card, bank or credit payments, and print or share receipts.' },
  { title: 'Inventory & stock ledger', body: 'Track quantities per product, low-stock thresholds, stock adjustments (count, damage, returns), and a history of movements tied to sales and receiving.' },
  { title: 'Sales history & refunds', body: 'Review receipts, void or refund completed sales when your role allows, and restore stock automatically on void or refund.' },
  { title: 'Reports & profit', body: 'Period filters for revenue, cost of goods, operating expenses, gross and net profit, and payment mix — so owners can separate sales from profit.' },
  { title: 'Customers & suppliers', body: 'Customer contacts and credit balances; supplier records and stock receiving for purchases.' },
  { title: 'Expenses & cash shifts', body: 'Log business expenses and open or close till sessions with opening float, cash sales, and variance.' },
  { title: 'Team, branches & permissions', body: 'Invite staff by email, assign roles, PIN lock on shared devices, and select active branch for multi-location shops.' },
  { title: 'Offline & sync', body: 'Sales and catalogue changes save on the device when offline. The Sync screen shows the outbox; when online, changes push to the cloud and pull updates from other devices.' },
  { title: 'Import, export & audit', body: 'CSV import for products and customers, export tools, and an audit log for voids, discounts, price and stock changes.' },
]

export default function FeaturesPage() {
  return (
    <>
      <Seo
        title="Features — POS, inventory, reports & offline sales"
        description="StockFlow features: point of sale, inventory, barcode scanning, profit reports, customers, suppliers, expenses, shifts, multi-user permissions, and offline sync."
        path="/features"
        jsonLd={[softwareJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Features', path: '/features' }])]}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">Product</p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight">Capabilities that match real shop work</h1>
        <p className="mt-3 text-[16px] text-ink-secondary leading-relaxed">
          Every item below is available in the current StockFlow application. We do not list restaurant, pharmacy, or fiscalization modules that are not shipped.
        </p>
        <div className="mt-10 space-y-6">
          {blocks.map((b) => (
            <article key={b.title} className="rounded-[18px] border border-border bg-white p-5 shadow-card">
              <h2 className="text-[18px] font-bold">{b.title}</h2>
              <p className="mt-2 text-[15px] text-ink-secondary leading-relaxed">{b.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/contact" className="press h-11 px-5 rounded-full bg-primary text-white font-semibold text-[14px]">Book a Demo</Link>
          <Link to="/pricing" className="press h-11 px-5 rounded-full border border-border font-semibold text-[14px]">Pricing</Link>
        </div>
      </div>
    </>
  )
}
