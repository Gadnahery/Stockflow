import { Link, useParams } from 'react-router-dom'
import Seo from '../../marketing/Seo'
import { articleJsonLd, breadcrumbJsonLd } from '../../lib/seo'
import { ARTICLES } from './ResourcesPage'

const BODY: Record<string, string[]> = {
  'what-is-a-pos-system': [
    'A point-of-sale (POS) system is the software and process you use to record a sale when a customer pays.',
    'Instead of only a notebook or a calculator, a POS keeps the product list, prices, quantities sold, payment method, and often a receipt number in one place.',
    'Modern retail POS tools also update stock when you sell, so you do not rely only on occasional physical counts.',
    'StockFlow provides a POS screen for shops: search or scan products, build a cart, take payment, and store the sale on the device — including when the internet is temporarily unavailable.',
  ],
  'track-daily-sales': [
    'Tracking daily sales means every completed transaction is recorded the same day, with a clear total and payment mix.',
    'At minimum, note the time, items or total amount, and how the customer paid. Software reduces missed entries and makes end-of-day cash counts easier.',
    'In StockFlow, completed sales appear in Sales history and feed Reports for today, seven days, or thirty days. Cash shifts help you compare expected cash with counted cash.',
  ],
  'low-stock-products': [
    'Low-stock products are items that have reached or fallen below a minimum quantity you set for safe trading.',
    'Without a minimum, staff only notice empty shelves after customers ask. With thresholds, you can reorder before you run out.',
    'StockFlow lets you set minimum stock per product, highlight low stock on inventory screens, and surface alerts on the notifications view.',
  ],
  'revenue-vs-profit': [
    'Sales revenue is the money customers pay for goods. Profit is what remains after product cost and operating expenses.',
    'A busy day with high revenue can still be weak if goods are sold near cost or expenses are high.',
    'StockFlow reports show sales revenue, cost of goods (from product cost), expenses you recorded, and net profit so owners can separate turnover from margin.',
  ],
  'choosing-pos-tanzania': [
    'Retailers in Tanzania often need software that works when mobile data is slow or offline, supports multiple staff, and keeps stock aligned with sales.',
    'Useful questions: Can cashiers sell without internet? Can the owner see profit, not only sales totals? Can you invite staff with limited permissions? Can you install on phone and computer?',
    'StockFlow is built around those practical needs for general retail shops. Official tax-device (VFD) integration is not claimed until it is implemented and verified.',
  ],
}

export default function ArticlePage() {
  const { slug } = useParams()
  const meta = ARTICLES.find((a) => a.slug === slug)
  const paragraphs = slug ? BODY[slug] : undefined

  if (!meta || !paragraphs) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-[22px] font-bold">Article not found</h1>
        <Link to="/resources" className="mt-4 inline-block text-primary font-semibold">
          Back to resources
        </Link>
      </div>
    )
  }

  return (
    <>
      <Seo
        title={meta.title}
        description={meta.description}
        path={`/resources/${meta.slug}`}
        type="article"
        jsonLd={[
          articleJsonLd({
            title: meta.title,
            description: meta.description,
            path: `/resources/${meta.slug}`,
            datePublished: meta.date,
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Resources', path: '/resources' },
            { name: meta.title, path: `/resources/${meta.slug}` },
          ]),
        ]}
      />
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[13px] text-ink-muted tabular-nums">{meta.date}</p>
        <h1 className="mt-2 text-[28px] md:text-[34px] font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-3 text-[16px] text-ink-secondary">{meta.description}</p>
        <div className="mt-8 space-y-4 text-[16px] text-ink-secondary leading-relaxed">
          {paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
        <p className="mt-10 text-[14px]">
          <Link to="/contact" className="text-primary font-semibold">
            Book a Demo
          </Link>
          {' · '}
          <Link to="/features" className="text-primary font-semibold">
            Features
          </Link>
        </p>
      </article>
    </>
  )
}
