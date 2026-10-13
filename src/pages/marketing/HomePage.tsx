import { Link } from 'react-router-dom'
import {
  ShoppingCart, Package, BarChart3, Users, Truck, Wallet, WifiOff, ScanLine, CheckCircle2,
} from 'lucide-react'
import Seo from '../../marketing/Seo'
import {
  organizationJsonLd, softwareJsonLd, websiteJsonLd, faqJsonLd,
} from '../../lib/seo'

const faqs = [
  {
    q: 'What is StockFlow?',
    a: 'StockFlow is retail point-of-sale and inventory software. Shop owners use it to record sales, track stock, manage customers and suppliers, log expenses, and review profit.',
  },
  {
    q: 'Who is StockFlow designed for?',
    a: 'General retail shops, minimarkets, electronics and accessories stores, cosmetics shops, stationery shops, and similar merchandise retailers in Tanzania and East Africa.',
  },
  {
    q: 'Does StockFlow work without internet?',
    a: 'Yes for day-to-day selling. Sales, products, and stock are stored on the device. When you are online again, changes sync to the cloud. Full multi-device sync needs a connection.',
  },
  {
    q: 'Can I scan barcodes?',
    a: 'Yes. The POS supports barcode search and camera scanning on supported devices.',
  },
  {
    q: 'Can I see daily sales and profit?',
    a: 'Yes. Reports show revenue, cost of goods, expenses, and net profit for today, 7 days, or 30 days.',
  },
  {
    q: 'Does StockFlow support multiple users?',
    a: 'Yes. Owners can invite staff, assign roles and permissions, and use PIN lock on shared devices.',
  },
  {
    q: 'How much does StockFlow cost?',
    a: 'Pricing depends on team size and needs. Use Book a Demo or the contact form for a quote. You can also create an account to try the product.',
  },
  {
    q: 'How do I get started?',
    a: 'Create an account, set up your business name, add products, and start selling on phone or computer. Or book a demo and we will walk you through it.',
  },
]

const features = [
  { icon: ShoppingCart, title: 'Point of sale', desc: 'Fast product search, cart, discounts, cash and mobile payments, and receipts.' },
  { icon: Package, title: 'Inventory', desc: 'Stock levels, low-stock alerts, adjustments, and a movement ledger.' },
  { icon: BarChart3, title: 'Reports & profit', desc: 'Sales trends, cost of goods, expenses, and net profit in one view.' },
  { icon: Users, title: 'Customers', desc: 'Customer records, credit balances, and payment history.' },
  { icon: Truck, title: 'Suppliers', desc: 'Supplier contacts and stock receiving workflows.' },
  { icon: Wallet, title: 'Expenses & shifts', desc: 'Record costs and open or close cash till sessions.' },
  { icon: WifiOff, title: 'Offline sales', desc: 'Keep selling when the network drops; sync when you reconnect.' },
  { icon: ScanLine, title: 'Barcode scanning', desc: 'Scan or type barcodes at the counter on supported devices.' },
]

export default function HomePage() {
  return (
    <>
      <Seo
        title="StockFlow | Retail POS & Inventory Management Software"
        description="Manage retail sales, stock levels, products and business reports with StockFlow. Built for everyday shop operations in Tanzania."
        path="/"
        jsonLd={[
          organizationJsonLd(),
          softwareJsonLd(),
          websiteJsonLd(),
          faqJsonLd(faqs),
        ]}
      />

      <section className="bg-gradient-to-b from-[#E8F1FF] to-white">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-widest text-primary uppercase">
              Retail POS & inventory management
            </p>
            <h1 className="mt-3 text-[32px] md:text-[44px] font-bold tracking-tight leading-[1.15]">
              Run your shop with more control.
            </h1>
            <p className="mt-4 text-[16px] md:text-[18px] text-ink-secondary leading-relaxed max-w-xl">
              Manage sales, track stock, monitor expenses and understand your business performance
              from one simple system. Designed for everyday retail operations in Tanzania.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="press h-12 px-6 rounded-full bg-primary text-white text-[15px] font-semibold"
              >
                Book a Demo
              </Link>
              <Link
                to="/features"
                className="press h-12 px-6 rounded-full bg-white border border-border text-ink text-[15px] font-semibold"
              >
                Explore Features
              </Link>
            </div>
            <ul className="mt-8 space-y-2">
              {['Sales at the counter', 'Stock and low-stock alerts', 'Profit & loss reports', 'Works offline on phone or PC'].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2 text-[14px] text-ink-secondary">
                    <CheckCircle2 size={18} className="text-success shrink-0" />
                    {t}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="rounded-[24px] bg-white shadow-float border border-border p-5 md:p-6">
            <p className="text-[12px] font-semibold text-ink-muted uppercase tracking-wide">Sample overview</p>
            <p className="mt-1 text-[22px] font-bold">Today’s sales</p>
            <p className="text-[36px] font-bold tabular-nums text-primary mt-1">125,000 <span className="text-[14px] text-ink-muted font-semibold">TZS</span></p>
            <p className="text-[13px] text-ink-secondary">Illustrative sample data — not a live shop.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ['Orders', '18'],
                ['Low stock', '4'],
                ['Gross margin', '42%'],
                ['Pending sync', '0'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[14px] bg-surface-secondary p-3">
                  <p className="text-[12px] text-ink-muted">{k}</p>
                  <p className="text-[18px] font-bold tabular-nums mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight">What StockFlow helps you do</h2>
        <p className="mt-2 text-[15px] text-ink-secondary max-w-2xl">
          One place for the daily work of a retail shop — from the till to stock and end-of-day numbers.
        </p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-[18px] border border-border bg-white p-5 shadow-card">
              <span className="h-10 w-10 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center">
                <f.icon size={20} />
              </span>
              <h3 className="mt-3 text-[16px] font-bold">{f.title}</h3>
              <p className="mt-1 text-[14px] text-ink-secondary leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link to="/features" className="text-primary font-semibold text-[15px]">
            See all features →
          </Link>
        </div>
      </section>

      <section className="bg-surface-secondary border-y border-border">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight">How it works</h2>
          <ol className="mt-8 grid md:grid-cols-3 gap-6">
            {[
              ['1', 'Set up your business', 'Create an account, name your shop, invite staff if needed, and add products.'],
              ['2', 'Sell and update stock', 'Record sales at the counter, receive supplier stock, and adjust counts.'],
              ['3', 'Review performance', 'Open reports for revenue, cost of goods, expenses, and net profit.'],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-[18px] bg-white border border-border p-5 shadow-card">
                <span className="text-[13px] font-bold text-primary">Step {n}</span>
                <h3 className="mt-1 text-[17px] font-bold">{t}</h3>
                <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight">Built for retail shops</h2>
        <p className="mt-2 text-[15px] text-ink-secondary max-w-2xl">
          General-purpose POS for merchandise retailers — not industry-specific manufacturing or restaurant modules.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            ['Retail shops', '/industries/retail-shops'],
            ['Minimarkets', '/industries/minimarkets'],
            ['Electronics & accessories', '/industries/retail-shops'],
            ['Cosmetics & stationery', '/industries/retail-shops'],
          ].map(([label, to]) => (
            <Link
              key={label}
              to={to}
              className="press h-10 px-4 rounded-full bg-white border border-border text-[14px] font-semibold text-ink"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight text-center">Frequently asked questions</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-[16px] border border-border bg-white px-4 py-3">
              <summary className="cursor-pointer list-none font-semibold text-[15px] flex justify-between gap-3">
                {f.q}
                <span className="text-ink-muted group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed pb-1">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-primary text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-[26px] md:text-[32px] font-bold tracking-tight">
            Take control of your shop operations.
          </h2>
          <p className="mt-3 text-[16px] text-white/85 max-w-xl mx-auto">
            See how StockFlow can help you manage sales, inventory and everyday business records.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/contact"
              className="press h-12 px-6 rounded-full bg-white text-primary text-[15px] font-semibold"
            >
              Book a Demo
            </Link>
            <Link
              to="/signup"
              className="press h-12 px-6 rounded-full border border-white/40 text-white text-[15px] font-semibold"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
