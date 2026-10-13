import { Link, useParams } from 'react-router-dom'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'

const COPY: Record<string, { title: string; description: string; body: string[] }> = {
  'retail-shops': {
    title: 'POS software for retail shops',
    description:
      'StockFlow for general retail shops: counter sales, product stock, customers, expenses, and profit reports.',
    body: [
      'General retail shops need a fast counter, a reliable product list, and a clear view of what sold today.',
      'StockFlow supports barcode or search-based selling, stock deductions on each sale, low-stock alerts, and reports that include cost of goods and expenses.',
      'It is a general merchandise POS — not a specialized manufacturing or restaurant system.',
    ],
  },
  minimarkets: {
    title: 'POS software for minimarkets',
    description:
      'How minimarkets can use StockFlow for high-frequency sales, stock counts, and end-of-day cash control.',
    body: [
      'Minimarkets often process many small transactions and must watch fast-moving grocery and household lines.',
      'StockFlow helps with quick POS entry, stock minimums, shift open/close for the till, and daily sales reports.',
      'Multi-user roles allow an owner to review profit while cashiers focus on selling.',
    ],
  },
}

export default function IndustryPage() {
  const { slug } = useParams()
  const page = slug ? COPY[slug] : undefined
  if (!page || !slug) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-[22px] font-bold">Page not found</h1>
        <Link to="/" className="text-primary font-semibold mt-4 inline-block">
          Home
        </Link>
      </div>
    )
  }
  const path = `/industries/${slug}`
  return (
    <>
      <Seo
        title={page.title}
        description={page.description}
        path={path}
        jsonLd={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: page.title, path },
        ])}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">Industries</p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight">{page.title}</h1>
        <div className="mt-6 space-y-4 text-[16px] text-ink-secondary leading-relaxed">
          {page.body.map((p) => (
            <p key={p.slice(0, 32)}>{p}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/contact" className="press h-11 px-5 rounded-full bg-primary text-white font-semibold text-[14px]">
            Book a Demo
          </Link>
          <Link to="/features" className="press h-11 px-5 rounded-full border border-border font-semibold text-[14px]">
            Features
          </Link>
        </div>
      </div>
    </>
  )
}
