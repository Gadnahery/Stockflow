import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight, ArrowRight, BarChart3, Check, ChevronDown, CircleHelp,
  Cloud, Command, CreditCard, Menu, Package, ScanBarcode, ShieldCheck,
  ShoppingBag, ShoppingCart, Smartphone, Sparkles, TrendingUp, Truck, X,
  Zap,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './LandingPage.css'

const features = [
  { icon: ShoppingCart, number: '01', title: 'Checkout without the clutter', text: 'Keep the counter moving with a focused point-of-sale workflow for everyday sales.' },
  { icon: Package, number: '02', title: 'Know what is on your shelves', text: 'Keep product quantities and stock movements in one place, with low-stock visibility.' },
  { icon: BarChart3, number: '03', title: 'Understand the day at a glance', text: 'Review sales activity and business reports without piecing together separate records.' },
  { icon: ScanBarcode, number: '04', title: 'Find products faster', text: 'Search by product details and use supported barcode-scanning workflows at checkout.' },
  { icon: Users, number: '05', title: 'Keep customer and supplier records close', text: 'Organize the people and suppliers your shop works with every day.' },
  { icon: Cloud, number: '06', title: 'Keep work moving when internet drops', text: 'StockFlow is designed with local data and a sync queue for supported offline workflows.' },
]


const faqs = [
  { q: 'What is StockFlow?', a: 'StockFlow is a retail point-of-sale and stock management application that brings checkout, products, stock movements and business reporting into one workspace.' },
  { q: 'Who is StockFlow for?', a: 'It is designed for shop owners and teams who want a clearer way to record sales and manage inventory. The best fit depends on the workflows your business needs.' },
  { q: 'Can I use StockFlow when the internet is unavailable?', a: 'StockFlow includes local data storage and queued synchronization for supported workflows. Some features, such as cloud synchronization, require an internet connection.' },
  { q: 'Can I use a barcode scanner?', a: 'StockFlow supports product search by barcode and includes a camera-based scanning workflow. Compatibility can depend on your device and scanner.' },
  { q: 'How do I get started?', a: 'Create an account, set up your business, add your products and start recording sales. You can also sign in if your business already has an account.' },
  { q: 'How much does StockFlow cost?', a: 'Sign up or contact the StockFlow team for current access and pricing information. We do not display unconfirmed prices on this page.' },
]

function ProductPreview() {
  return (
    <div className="sf-preview-wrap" aria-label="Illustration of the StockFlow business dashboard">
      <div className="sf-preview-glow" />
      <div className="sf-float-note sf-float-note-top">
        <span className="sf-float-icon"><TrendingUp size={16} /></span>
        <span><strong>Sales at a glance</strong><small>Your day, in one view</small></span>
        <span className="sf-note-dot" />
      </div>
      <div className="sf-dashboard-preview">
        <div className="sf-dash-sidebar">
          <div className="sf-mini-brand"><span className="sf-brand-mark"><Package size={15} /></span><b>stockflow</b></div>
          <div className="sf-mini-nav sf-mini-nav-active"><ShoppingCart size={14} /> Point of sale</div>
          <div className="sf-mini-nav"><BarChart3 size={14} /> Overview</div>
          <div className="sf-mini-nav"><Package size={14} /> Products</div>
          <div className="sf-mini-nav"><Truck size={14} /> Suppliers</div>
          <div className="sf-mini-sidebar-bottom"><span className="sf-mini-avatar">S</span><span><b>Shop manager</b><small>Workspace</small></span></div>
        </div>
        <div className="sf-dash-main">
          <div className="sf-dash-top"><div><span className="sf-dash-kicker">TODAY'S OVERVIEW</span><h3>Good morning 👋</h3><p>Here’s what’s happening in your shop.</p></div><span className="sf-demo-pill"><span /> Preview data</span></div>
          <div className="sf-stat-grid">
            <div className="sf-stat-card"><span>Sales today</span><strong>TSh 486,000</strong><small className="sf-stat-positive"><TrendingUp size={12} /> Daily overview</small><div className="sf-sparkline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
            <div className="sf-stat-card"><span>Transactions</span><strong>38</strong><small>Recorded today</small><div className="sf-mini-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
            <div className="sf-stat-card sf-stat-stock"><span>Stock to review</span><strong>06 <em>items</em></strong><small>At reorder level</small><div className="sf-stock-line"><span /><span /><span /></div></div>
          </div>
          <div className="sf-dash-bottom">
            <div className="sf-chart-card"><div className="sf-chart-head"><span><b>Sales activity</b><small>Sales overview</small></span><span className="sf-chart-filter">This week⌄</span></div><div className="sf-chart-amount">TSh 2.84M <span>sample</span></div><div className="sf-chart"><div className="sf-chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 420 110" role="img" aria-label="Illustrative weekly sales line chart"><defs><linearGradient id="sf-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3978F6" stopOpacity=".2" /><stop offset="100%" stopColor="#3978F6" stopOpacity="0" /></linearGradient></defs><path d="M0 83 C28 78 36 60 65 68 S104 84 132 54 S174 66 200 45 S241 57 269 32 S310 47 340 24 S385 32 420 8 L420 110 L0 110 Z" fill="url(#sf-chart-fill)" /><path d="M0 83 C28 78 36 60 65 68 S104 84 132 54 S174 66 200 45 S241 57 269 32 S310 47 340 24 S385 32 420 8" fill="none" stroke="#3978F6" strokeWidth="3" strokeLinecap="round" /></svg></div><div className="sf-chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div>
            <div className="sf-recent-card"><div className="sf-chart-head"><span><b>Recent activity</b><small>Latest records</small></span><span className="sf-mini-more">•••</span></div><div className="sf-activity-row"><span className="sf-activity-symbol blue"><ShoppingCart size={13} /></span><span><b>Sale recorded</b><small>Counter sale</small></span><strong>+ TSh 48k</strong></div><div className="sf-activity-row"><span className="sf-activity-symbol amber"><Package size={13} /></span><span><b>Stock updated</b><small>Product inventory</small></span><strong>Updated</strong></div><div className="sf-activity-row"><span className="sf-activity-symbol violet"><CreditCard size={13} /></span><span><b>Expense added</b><small>Business record</small></span><strong>Recorded</strong></div></div>
          </div>
        </div>
      </div>
      <div className="sf-float-note sf-float-note-bottom"><span className="sf-float-icon sf-float-icon-green"><Check size={16} /></span><span><strong>Stock stays in view</strong><small>Products · Sales · Reports</small></span></div>
      <div className="sf-preview-caption"><Sparkles size={13} /> Product interface preview · Sample figures</div>
    </div>
  )
}

export default function LandingPage() {
  const { session, member } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const appPath = session && member ? '/pos' : '/signup'
  const ctaLabel = session && member ? 'Open your workspace' : 'Get started'

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="sf-landing">
      <a className="sf-skip-link" href="#main-content">Skip to content</a>
      <div className="sf-announcement"><span className="sf-announcement-dot" /> A clearer way to run your shop <ArrowRight size={13} /></div>
      <header className="sf-site-header">
        <div className="sf-nav-inner">
          <Link to="/" className="sf-wordmark" aria-label="StockFlow home" onClick={closeMenu}><span className="sf-brand-mark"><Package size={18} strokeWidth={2.4} /></span><span>stockflow<span className="sf-wordmark-period">.</span></span></Link>
          <nav className={`sf-nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#features" onClick={closeMenu}>Features</a>
            <a href="#how-it-works" onClick={closeMenu}>How it works</a>
            <a href="#businesses" onClick={closeMenu}>For your business</a>
            <a href="#faq" onClick={closeMenu}>FAQs</a>
            <div className="sf-mobile-nav-actions"><Link to="/login" onClick={closeMenu}>Sign in</Link><Link className="sf-button sf-button-primary" to={appPath} onClick={closeMenu}>{ctaLabel}<ArrowRight size={16} /></Link></div>
          </nav>
          <div className="sf-desktop-actions"><Link className="sf-signin" to="/login">Sign in</Link><Link className="sf-button sf-button-primary sf-nav-cta" to={appPath}>{ctaLabel}<ArrowRight size={16} /></Link></div>
          <button className="sf-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </header>

      <main id="main-content">
        <section className="sf-hero sf-container">
          <div className="sf-hero-copy">
            <div className="sf-eyebrow"><span className="sf-eyebrow-icon"><Zap size={14} fill="currentColor" /></span> RETAIL POS & STOCK MANAGEMENT</div>
            <h1>Your shop.<br /><span>Under control.</span></h1>
            <p className="sf-hero-description">Sales, stock and everyday business records — together in one calm, clear workspace.</p>
            <div className="sf-hero-actions"><Link className="sf-button sf-button-primary sf-button-large" to={appPath}>{ctaLabel}<ArrowRight size={17} /></Link><a className="sf-button sf-button-secondary sf-button-large" href="#features">Explore StockFlow<ArrowDownRight size={16} /></a></div>
            <div className="sf-hero-points"><span><Check size={15} /> Simple to navigate</span><span><Check size={15} /> Built for daily retail</span></div>
            <div className="sf-hero-note"><ShieldCheck size={15} /> Your business records, organized in one place.</div>
          </div>
          <div className="sf-hero-visual"><ProductPreview /></div>
        </section>

        <section className="sf-trust-strip" aria-label="StockFlow capabilities">
          <div className="sf-container sf-trust-inner"><span>ONE WORKSPACE FOR YOUR DAILY OPERATIONS</span><div><span><ShoppingCart size={16} /> Sales</span><span><Package size={16} /> Inventory</span><span><BarChart3 size={16} /> Reports</span><span><Smartphone size={16} /> Desktop & mobile</span></div></div>
        </section>

        <section id="features" className="sf-section sf-features-section">
          <div className="sf-container">
            <div className="sf-section-heading"><div><span className="sf-section-kicker">LESS GUESSWORK. MORE CLARITY.</span><h2>Everything connected.<br /><span>Nothing overcomplicated.</span></h2></div><p>Give your team a clearer way to handle the everyday work of running a shop — from the first sale to the end-of-day review.</p></div>
            <div className="sf-feature-grid">{features.map(({ icon: Icon, number, title, text }) => <article className="sf-feature-card" key={number}><div className="sf-feature-top"><span className="sf-feature-icon"><Icon size={20} strokeWidth={1.9} /></span><span className="sf-feature-number">{number}</span></div><h3>{title}</h3><p>{text}</p><span className="sf-feature-arrow" aria-hidden="true"><ArrowRight size={16} /></span></article>)}</div>
          </div>
        </section>

        <section id="how-it-works" className="sf-section sf-work-section">
          <div className="sf-container sf-work-layout"><div className="sf-work-intro"><span className="sf-section-kicker">A SIMPLER DAILY RHYTHM</span><h2>From first sale<br />to <span>clearer decisions.</span></h2><p>StockFlow brings the records you need closer to the work you already do. Start with the essentials and build a more consistent routine for your business.</p><Link className="sf-text-link" to={appPath}>{ctaLabel}<ArrowRight size={16} /></Link></div><div className="sf-steps"><article className="sf-step"><span className="sf-step-number">01</span><div><h3>Set up your products</h3><p>Build your product list and keep important stock details organized.</p></div><span className="sf-step-icon"><Package size={20} /></span></article><article className="sf-step"><span className="sf-step-number">02</span><div><h3>Record each sale</h3><p>Use the point of sale to keep transactions and inventory connected.</p></div><span className="sf-step-icon"><ShoppingCart size={20} /></span></article><article className="sf-step"><span className="sf-step-number">03</span><div><h3>Review your business</h3><p>Use sales reports and stock visibility to plan what needs attention next.</p></div><span className="sf-step-icon"><BarChart3 size={20} /></span></article></div></div>
        </section>

        <section id="businesses" className="sf-section sf-business-section">
          <div className="sf-container"><div className="sf-business-panel"><div className="sf-business-copy"><span className="sf-section-kicker sf-kicker-light">MADE FOR THE WORK BEHIND THE COUNTER</span><h2>A better overview<br />of your everyday shop.</h2><p>Whether your business sells household essentials, electronics or general merchandise, start with the workflows that matter most: sales, products and stock visibility.</p><Link className="sf-button sf-button-light" to={appPath}>{ctaLabel}<ArrowRight size={16} /></Link></div><div className="sf-business-tiles"><div className="sf-business-tile sf-business-tile-one"><span className="sf-tile-icon"><ShoppingBag size={20} /></span><b>Retail shops</b><small>Sales and stock in one place</small><span className="sf-tile-decoration">01</span></div><div className="sf-business-tile sf-business-tile-two"><span className="sf-tile-icon"><Package size={20} /></span><b>Minimarkets</b><small>Keep products in view</small><span className="sf-tile-decoration">02</span></div><div className="sf-business-tile sf-business-tile-three"><span className="sf-tile-icon"><ScanBarcode size={20} /></span><b>Electronics & accessories</b><small>Find products with less friction</small><span className="sf-tile-decoration">03</span></div><div className="sf-business-tile sf-business-tile-four"><span className="sf-tile-icon"><Command size={20} /></span><b>Growing businesses</b><small>A clearer daily routine</small><span className="sf-tile-decoration">04</span></div></div></div></div>
        </section>

        <section className="sf-section sf-faq-section" id="faq"><div className="sf-container sf-faq-layout"><div className="sf-faq-intro"><span className="sf-section-kicker">GOOD TO KNOW</span><h2>Questions, answered.</h2><p>Want to know whether StockFlow fits your shop? Start here.</p><div className="sf-faq-help"><CircleHelp size={18} /><span>Still have a question?<small>Get started and explore the product.</small></span></div></div><div className="sf-faq-list">{faqs.map((faq, index) => <article className={`sf-faq-item ${openFaq === index ? 'is-open' : ''}`} key={faq.q}><h3><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{faq.q}<ChevronDown size={18} /></button></h3><p hidden={openFaq !== index}>{faq.a}</p></article>)}</div></div></section>

        <section className="sf-final-cta"><div className="sf-container sf-final-cta-inner"><div><span className="sf-section-kicker sf-kicker-light">MAKE THE NEXT DAY CLEARER</span><h2>Run your shop with<br />more confidence.</h2><p>Bring sales, stock and everyday records into one workspace.</p></div><div className="sf-final-actions"><Link className="sf-button sf-button-light sf-button-large" to={appPath}>{ctaLabel}<ArrowRight size={17} /></Link><span>No complicated pitch. Just a clearer way to work.</span></div><div className="sf-cta-orbit sf-cta-orbit-one" /><div className="sf-cta-orbit sf-cta-orbit-two" /></div></section>
      </main>

      <footer className="sf-footer"><div className="sf-container"><div className="sf-footer-main"><div className="sf-footer-brand"><Link to="/" className="sf-wordmark"><span className="sf-brand-mark"><Package size={18} strokeWidth={2.4} /></span><span>stockflow<span className="sf-wordmark-period">.</span></span></Link><p>A clearer way to manage retail sales, stock and everyday business records.</p></div><div className="sf-footer-links"><div><b>Explore</b><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#businesses">For your business</a><a href="#faq">FAQs</a></div><div><b>Your account</b><Link to="/login">Sign in</Link><Link to="/signup">Create account</Link><a href="#faq">Help & FAQs</a></div></div></div><div className="sf-footer-bottom"><span>© {new Date().getFullYear()} StockFlow. All rights reserved.</span><span>Built for clearer business days.</span></div></div></footer>
    </div>
  )
}
