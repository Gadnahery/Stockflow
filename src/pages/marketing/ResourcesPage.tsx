import { Link } from 'react-router-dom'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'

export const ARTICLES = [
  {
    slug: 'what-is-a-pos-system',
    title: 'What is a point-of-sale system?',
    description: 'A plain-language explanation of POS software for small retail shops.',
    date: '2026-10-01',
  },
  {
    slug: 'track-daily-sales',
    title: 'How a shop can track daily sales',
    description: 'Practical habits for recording sales and checking end-of-day totals.',
    date: '2026-10-05',
  },
  {
    slug: 'low-stock-products',
    title: 'How to identify low-stock products',
    description: 'Why minimum stock levels matter and how software helps you act early.',
    date: '2026-10-08',
  },
  {
    slug: 'revenue-vs-profit',
    title: 'Sales revenue vs profit',
    description: 'The difference between money in from sales and what you actually keep after costs.',
    date: '2026-10-10',
  },
  {
    slug: 'choosing-pos-tanzania',
    title: 'What Tanzanian retailers should consider in POS software',
    description: 'Offline use, multi-user access, stock, and reporting priorities for local shops.',
    date: '2026-10-12',
  },
]

export default function ResourcesPage() {
  return (
    <>
      <Seo
        title="Resources — POS and inventory guides"
        description="Educational guides for retail shop owners: POS basics, daily sales, low stock, revenue vs profit, and choosing software in Tanzania."
        path="/resources"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Resources', path: '/resources' }])}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">Resources</p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight">Guides for shop owners</h1>
        <p className="mt-3 text-[16px] text-ink-secondary">
          Short articles that answer common questions. Where StockFlow helps, we say so clearly — without inventing capabilities.
        </p>
        <ul className="mt-10 space-y-4">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                to={`/resources/${a.slug}`}
                className="block rounded-[18px] border border-border bg-white p-5 shadow-card hover:border-primary/30"
              >
                <p className="text-[12px] text-ink-muted tabular-nums">{a.date}</p>
                <h2 className="mt-1 text-[17px] font-bold text-ink">{a.title}</h2>
                <p className="mt-1 text-[14px] text-ink-secondary">{a.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
