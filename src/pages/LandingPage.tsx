import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import Seo from '../marketing/Seo'
import {
  organizationJsonLd,
  softwareJsonLd,
  websiteJsonLd,
  faqJsonLd,
} from '../lib/seo'
import './LandingPage.css'

const PILLAR_IMGS = [
  {
    image:
      'https://images.unsplash.com/photo-1556740758-90de374c12ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=85',
    alt: 'Retail counter',
    titleKey: 'work.sell.title' as const,
    textKey: 'work.sell.text' as const,
  },
  {
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=85',
    alt: 'Stock shelves',
    titleKey: 'work.stock.title' as const,
    textKey: 'work.stock.text' as const,
  },
  {
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=85',
    alt: 'Reports',
    titleKey: 'work.numbers.title' as const,
    textKey: 'work.numbers.text' as const,
  },
]

export default function LandingPage() {
  const { session, member } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const appPath = session && member ? '/pos' : '/signup'
  const ctaLabel = session && member ? t('nav.openPos') : t('nav.getStarted')

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

  const faqs = [
    { q: t('faq.1.q'), a: t('faq.1.a') },
    { q: t('faq.2.q'), a: t('faq.2.a') },
    { q: t('faq.3.q'), a: t('faq.3.a') },
    { q: t('faq.4.q'), a: t('faq.4.a') },
  ]

  const toggleLang = () => setLocale(locale === 'en' ? 'sw' : 'en')

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
              <a href="#work">{t('nav.what')}</a>
              <a href="#how">{t('nav.how')}</a>
              <a href="#faq">{t('nav.faq')}</a>
              <Link to="/pricing">{t('nav.pricing')}</Link>
            </nav>

            <div className="sf-lp-actions">
              <button type="button" className="sf-lp-lang" onClick={toggleLang} aria-label={t('nav.langFull')}>
                {t('nav.lang')}
              </button>
              <Link to="/login" className="sf-lp-ghost">
                {t('nav.signin')}
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
              <a href="#work" onClick={() => setMenu(false)}>{t('nav.what')}</a>
              <a href="#how" onClick={() => setMenu(false)}>{t('nav.how')}</a>
              <a href="#faq" onClick={() => setMenu(false)}>{t('nav.faq')}</a>
              <Link to="/pricing" onClick={() => setMenu(false)}>{t('nav.pricing')}</Link>
              <Link to="/contact" onClick={() => setMenu(false)}>{t('nav.contact')}</Link>
            </nav>
            <button type="button" className="sf-lp-lang sf-lp-lang-drawer" onClick={toggleLang}>
              {t('nav.langFull')}
            </button>
            <Link to={appPath} className="sf-lp-btn sf-lp-btn-block" onClick={() => setMenu(false)}>
              {ctaLabel}
            </Link>
            <Link to="/login" className="sf-lp-drawer-sign" onClick={() => setMenu(false)}>
              {t('nav.signin')}
            </Link>
          </div>
        )}

        <main id="main">
          <section className="sf-lp-hero">
            <div className="sf-lp-hero-media" aria-hidden="true">
              <img
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=2400&q=85"
                alt=""
                fetchPriority="high"
              />
            </div>
            <div className="sf-lp-hero-scrim" aria-hidden="true" />
            <div className="sf-lp-hero-content">
              <p className="sf-lp-kicker">{t('hero.kicker')}</p>
              <h1>
                {t('hero.title1')}
                <em> {t('hero.title2')}</em>
              </h1>
              <p className="sf-lp-lead">{t('hero.lead')}</p>
              <div className="sf-lp-hero-cta">
                <Link to={appPath} className="sf-lp-btn sf-lp-btn-light">
                  {ctaLabel}
                  <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <a href="#work" className="sf-lp-btn sf-lp-btn-outline">
                  {t('hero.explore')}
                </a>
              </div>
            </div>
          </section>

          <section id="work" className="sf-lp-section">
            <div className="sf-lp-wrap">
              <p className="sf-lp-kicker sf-lp-kicker-dark">{t('work.kicker')}</p>
              <h2 className="sf-lp-display">
                {t('work.title1')}
                <em> {t('work.title2')}</em>
              </h2>
              <p className="sf-lp-sub">{t('work.sub')}</p>
              <div className="sf-lp-pillars">
                {PILLAR_IMGS.map((p) => (
                  <article key={p.titleKey} className="sf-lp-pillar">
                    <div className="sf-lp-pillar-img">
                      <img src={p.image} alt={p.alt} loading="lazy" />
                    </div>
                    <h3>{t(p.titleKey)}</h3>
                    <p>{t(p.textKey)}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="sf-lp-strip">
            <div className="sf-lp-wrap sf-lp-strip-grid">
              <div>
                <p className="sf-lp-kicker sf-lp-kicker-dark">{t('strip.kicker')}</p>
                <h2 className="sf-lp-display">
                  {t('strip.title1')}
                  <em> {t('strip.title2')}</em>
                </h2>
                <ul className="sf-lp-ticks">
                  <li>{t('strip.t1')}</li>
                  <li>{t('strip.t2')}</li>
                  <li>{t('strip.t3')}</li>
                  <li>{t('strip.t4')}</li>
                </ul>
                <Link to="/features" className="sf-lp-text-link">
                  {t('strip.link')} <ArrowRight size={15} />
                </Link>
              </div>
              <div className="sf-lp-strip-photo">
                <img
                  src="https://images.unsplash.com/photo-1556742111-a301076d9d18?ixlib=rb-4.0.3&auto=format&fit=crop&w=1400&q=85"
                  alt=""
                  loading="lazy"
                />
              </div>
            </div>
          </section>

          <section id="how" className="sf-lp-section sf-lp-section-soft">
            <div className="sf-lp-wrap">
              <p className="sf-lp-kicker sf-lp-kicker-dark">{t('how.kicker')}</p>
              <h2 className="sf-lp-display">{t('how.title')}</h2>
              <ol className="sf-lp-steps">
                {(
                  [
                    ['01', 'how.1.title', 'how.1.text'],
                    ['02', 'how.2.title', 'how.2.text'],
                    ['03', 'how.3.title', 'how.3.text'],
                  ] as const
                ).map(([n, tk, tx]) => (
                  <li key={n}>
                    <span>{n}</span>
                    <div>
                      <strong>{t(tk)}</strong>
                      <p>{t(tx)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="faq" className="sf-lp-section">
            <div className="sf-lp-wrap sf-lp-faq-grid">
              <div>
                <p className="sf-lp-kicker sf-lp-kicker-dark">{t('faq.kicker')}</p>
                <h2 className="sf-lp-display">
                  {t('faq.title1')}
                  <em> {t('faq.title2')}</em>
                </h2>
              </div>
              <div className="sf-lp-faq-list">
                {faqs.map((f, i) => (
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

          <section className="sf-lp-final">
            <div className="sf-lp-final-media" aria-hidden="true">
              <img
                src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?ixlib=rb-4.0.3&auto=format&fit=crop&w=2200&q=85"
                alt=""
                loading="lazy"
              />
            </div>
            <div className="sf-lp-final-scrim" aria-hidden="true" />
            <div className="sf-lp-final-content">
              <h2>
                {t('final.title1')}
                <em> {t('final.title2')}</em>
              </h2>
              <div className="sf-lp-hero-cta">
                <Link to={appPath} className="sf-lp-btn sf-lp-btn-light">
                  {ctaLabel}
                  <ArrowRight size={16} />
                </Link>
                <Link to="/contact" className="sf-lp-btn sf-lp-btn-outline">
                  {t('final.demo')}
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
              <p>{t('footer.tag')}</p>
            </div>
            <div className="sf-lp-footer-links">
              <Link to="/features">{t('nav.features')}</Link>
              <Link to="/pricing">{t('nav.pricing')}</Link>
              <Link to="/resources">{t('nav.resources')}</Link>
              <Link to="/contact">{t('nav.contact')}</Link>
              <Link to="/privacy">{t('footer.privacy')}</Link>
              <Link to="/terms">{t('footer.terms')}</Link>
              <Link to="/login">{t('nav.signin')}</Link>
            </div>
          </div>
          <div className="sf-lp-wrap sf-lp-footer-copy">
            <span>© {new Date().getFullYear()} StockFlow</span>
            <span>{t('footer.region')}</span>
          </div>
        </footer>
      </div>
    </>
  )
}
