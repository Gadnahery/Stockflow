import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Seo from '../marketing/Seo'
import {
  organizationJsonLd,
  softwareJsonLd,
  websiteJsonLd,
  faqJsonLd,
} from '../lib/seo'
import './LandingPage.css'

const FAQS = [
  {
    q: 'What is StockFlow?',
    a: 'StockFlow is point-of-sale and inventory software for retail shops. Record sales, track stock, manage staff, and review profit from one place.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes for everyday selling. Sales and products stay on the device. When you are online again, changes sync to the cloud.',
  },
  {
    q: 'Who is it for?',
    a: 'Independent retail shops, minimarkets, electronics and accessories stores, and similar merchandise businesses in Tanzania and East Africa.',
  },
  {
    q: 'How do I start?',
    a: 'Create an account, set up your shop name, add products, and start selling on your phone or computer — or book a short demo first.',
  },
]

const PILLARS = [
  {
    title: 'Sell at the counter',
    text: 'Search or scan products, take payment, and hand over a clear receipt — without losing the sale when the network drops.',
    image:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85',
    alt: 'Retail counter transaction',
  },
  {
    title: 'Know your stock',
    text: 'See what is on the shelf, what is running low, and every movement tied to sales and receiving.',
    image:
      'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1200&q=85',
    alt: 'Organized retail products on shelves',
  },
  {
    title: 'Read the real numbers',
    text: 'Revenue is not profit. Reports show cost of goods, expenses, and net result so you can decide with clarity.',
    image:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85',
    alt: 'Business reports on a laptop',
  },
]

export default function LandingPage() {
  const { session, member } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const appPath = session && member ? '/pos' : '/signup'
  const ctaLabel = session && member ? 'Open POS' : 'Get started'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menu])

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
          faqJsonLd(FAQS),
        ]}
      />

      <div className="sf-lp">
        <a className="sf-lp-skip" href="#main">
          Skip to content
        </a>

        <header className={`sf-lp-header${scrolled ? ' is-scrolled' : ''}`}>
          <div className="sf-lp-header-inner">
            <Link to="/" className="sf-lp-brand" aria-label="StockFlow home">
              <span className="sf-lp-mark">SF</span>
              <span className="sf-lp-word">StockFlow</span>
            </Link>

            <nav className="sf-lp-nav" aria-label="Primary">
              <a href="#work">What it does</a>
              <a href="#how">How it works</a>
              <a href="#faq">FAQ</a>
              <Link to="/pricing">Pricing</Link>
            </nav>

            <div className="sf-lp-actions">
              <Link to="/login" className="sf-lp-ghost">
                Sign in
              </Link>
              <Link to={appPath} className="sf-lp-btn">
                {ctaLabel}
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <button
                type="button"
                className="sf-lp-menu-btn"
                aria-label="Open menu"
                onClick={() => setMenu(true)}
              >
                <Menu size={20} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </header>

        {menu && (
          <div className="sf-lp-drawer" role="dialog" aria-modal="true">
            <div className="sf-lp-drawer-top">
              <span className="sf-lp-brand">
                <span className="sf-lp-mark">SF</span>
                <span className="sf-lp-word">StockFlow</span>
              </span>
              <button type="button" aria-label="Close menu" onClick={() => setMenu(false)}>
                <X size={22} strokeWidth={1.75} />
              </button>
            </div>
            <nav className="sf-lp-drawer-nav">
              {[
                ['#work', 'What it does'],
                ['#how', 'How it works'],
                ['#faq', 'FAQ'],
                ['/pricing', 'Pricing'],
                ['/contact', 'Contact'],
              ].map(([href, label]) =>
                href.startsWith('#') ? (
                  <a key={href} href={href} onClick={() => setMenu(false)}>
                    {label}
                  </a>
                ) : (
                  <Link key={href} to={href} onClick={() => setMenu(false)}>
                    {label}
                  </Link>
                ),
              )}
            </nav>
            <Link to={appPath} className="sf-lp-btn sf-lp-btn-block" onClick={() => setMenu(false)}>
              {ctaLabel}
            </Link>
            <Link to="/login" className="sf-lp-drawer-sign" onClick={() => setMenu(false)}>
              Sign in
            </Link>
          </div>
        )}

        <main id="main">
          {/* Hero — salon-style full bleed */}
          <section className="sf-lp-hero">
            <div className="sf-lp-hero-media" aria-hidden="true">
              <img
                src="https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=2400&q=90"
                alt=""
                fetchPriority="high"
              />
            </div>
            <div className="sf-lp-hero-scrim" aria-hidden="true" />
            <div className="sf-lp-hero-content">
              <p className="sf-lp-kicker">Point of sale · Stock management</p>
              <h1>
                Know your shop.
                <em> Run it better.</em>
              </h1>
              <p className="sf-lp-lead">
                Sales, stock, and clear profit numbers — in one calm workspace built for everyday
                retail in Tanzania.
              </p>
              <div className="sf-lp-hero-cta">
                <Link to={appPath} className="sf-lp-btn sf-lp-btn-light">
                  {ctaLabel}
                  <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <a href="#work" className="sf-lp-btn sf-lp-btn-outline">
                  See how it works
                </a>
              </div>
            </div>
          </section>

          {/* Three pillars with photography */}
          <section id="work" className="sf-lp-section">
            <div className="sf-lp-wrap">
              <p className="sf-lp-kicker sf-lp-kicker-dark">What it does</p>
              <h2 className="sf-lp-display">
                Less noise.
                <em> More control.</em>
              </h2>
              <p className="sf-lp-sub">
                Three jobs every retailer needs done well — without a crowded feature list.
              </p>
              <div className="sf-lp-pillars">
                {PILLARS.map((p) => (
                  <article key={p.title} className="sf-lp-pillar">
                    <div className="sf-lp-pillar-img">
                      <img src={p.image} alt={p.alt} loading="lazy" />
                    </div>
                    <h3>{p.title}</h3>
                    <p>{p.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Quiet product strip */}
          <section className="sf-lp-strip">
            <div className="sf-lp-wrap sf-lp-strip-grid">
              <div>
                <p className="sf-lp-kicker sf-lp-kicker-dark">On the device</p>
                <h2 className="sf-lp-display">
                  Built for the counter
                  <em> and the quiet hours after.</em>
                </h2>
                <ul className="sf-lp-ticks">
                  <li>Offline sales when the network fails</li>
                  <li>Barcode search on supported phones</li>
                  <li>Team roles, PIN lock, and branches</li>
                  <li>Sync when you are back online</li>
                </ul>
                <Link to="/features" className="sf-lp-text-link">
                  Full capabilities <ArrowRight size={15} />
                </Link>
              </div>
              <div className="sf-lp-strip-photo">
                <img
                  src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1400&q=85"
                  alt="Shop owner with a customer at the counter"
                  loading="lazy"
                />
              </div>
            </div>
          </section>

          {/* How it works — 3 steps only */}
          <section id="how" className="sf-lp-section sf-lp-section-soft">
            <div className="sf-lp-wrap">
              <p className="sf-lp-kicker sf-lp-kicker-dark">How it works</p>
              <h2 className="sf-lp-display">Three steps.</h2>
              <ol className="sf-lp-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Set up your shop</strong>
                    <p>Create an account, name the business, add products and optional staff.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Sell and update stock</strong>
                    <p>Record sales at the till, receive supplier stock, adjust counts when needed.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Review the day</strong>
                    <p>Open reports for revenue, cost of goods, expenses, and net profit.</p>
                  </div>
                </li>
              </ol>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="sf-lp-section">
            <div className="sf-lp-wrap sf-lp-faq-grid">
              <div>
                <p className="sf-lp-kicker sf-lp-kicker-dark">FAQ</p>
                <h2 className="sf-lp-display">
                  Straight
                  <em> answers.</em>
                </h2>
              </div>
              <div className="sf-lp-faq-list">
                {FAQS.map((f, i) => (
                  <div key={f.q} className={`sf-lp-faq${openFaq === i ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      aria-expanded={openFaq === i}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      {f.q}
                      <span aria-hidden="true">{openFaq === i ? '−' : '+'}</span>
                    </button>
                    {openFaq === i && <p>{f.a}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="sf-lp-final">
            <div className="sf-lp-final-media" aria-hidden="true">
              <img
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2200&q=85"
                alt=""
                loading="lazy"
              />
            </div>
            <div className="sf-lp-final-scrim" aria-hidden="true" />
            <div className="sf-lp-final-content">
              <h2>
                Ready for a clearer
                <em> view of your shop?</em>
              </h2>
              <div className="sf-lp-hero-cta">
                <Link to={appPath} className="sf-lp-btn sf-lp-btn-light">
                  {ctaLabel}
                  <ArrowRight size={16} />
                </Link>
                <Link to="/contact" className="sf-lp-btn sf-lp-btn-outline">
                  Book a demo
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="sf-lp-footer">
          <div className="sf-lp-wrap sf-lp-footer-grid">
            <div>
              <div className="sf-lp-brand">
                <span className="sf-lp-mark">SF</span>
                <span className="sf-lp-word">StockFlow</span>
              </div>
              <p>Retail POS and inventory for shops that want calm, accurate records.</p>
            </div>
            <div className="sf-lp-footer-links">
              <Link to="/features">Features</Link>
              <Link to="/pricing">Pricing</Link>
              <Link to="/resources">Resources</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/login">Sign in</Link>
            </div>
          </div>
          <div className="sf-lp-wrap sf-lp-footer-copy">
            <span>© {new Date().getFullYear()} StockFlow</span>
            <span>Tanzania · East Africa</span>
          </div>
        </footer>
      </div>
    </>
  )
}
