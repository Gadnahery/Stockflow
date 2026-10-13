import { Link } from 'react-router-dom'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd, organizationJsonLd } from '../../lib/seo'

export default function AboutPage() {
  return (
    <>
      <Seo
        title="About StockFlow"
        description="StockFlow builds retail POS and inventory software for shop owners in Tanzania and East Africa who need clear sales, stock, and profit records."
        path="/about"
        jsonLd={[organizationJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }])]}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">About</p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight">Software for real retail counters</h1>
        <div className="mt-6 space-y-4 text-[16px] text-ink-secondary leading-relaxed">
          <p>
            StockFlow is a point-of-sale and inventory product aimed at independent retailers and small multi-branch shops.
            The focus is practical daily work: selling quickly, knowing what is in stock, and reading honest profit numbers.
          </p>
          <p>
            The application supports offline sales on the device, synchronization when a network is available, team roles,
            branches, barcode workflows, and reports that separate revenue from cost of goods and expenses.
          </p>
          <p>
            We build for East African retail contexts — including Tanzania — without claiming features we have not shipped,
            such as official fiscal device integration or specialized restaurant kitchen modules.
          </p>
        </div>
        <Link to="/contact" className="press mt-8 inline-flex h-11 px-5 rounded-full bg-primary text-white font-semibold text-[14px]">
          Contact us
        </Link>
      </div>
    </>
  )
}
