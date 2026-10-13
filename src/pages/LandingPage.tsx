import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight, ArrowRight, BarChart3, Check, ChevronDown, CircleHelp,
  Menu, Package, ScanBarcode, ShoppingBag, ShoppingCart, Smartphone, Truck,
  Users, X, Zap,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './LandingPage.css'

const features = [
  { icon: ShoppingCart, title: 'Sales that stay organized', text: 'A focused checkout flow helps you record daily transactions without unnecessary steps.' },
  { icon: Package, title: 'Stock you can trust', text: 'Keep quantities, product details and stock movements together, where they belong.' },
  { icon: BarChart3, title: 'A clearer view of business', text: 'Review your sales and business activity without searching through separate records.' },
  { icon: ScanBarcode, title: 'Find products quickly', text: 'Search your catalogue and use supported barcode-scanning workflows at checkout.' },
  { icon: Users, title: 'Your business relationships', text: 'Keep customer and supplier details close to the work you do every day.' },
  { icon: Smartphone, title: 'Made for your workflow', text: 'Use a responsive workspace designed to work across desktop and mobile screens.' },
]

const faqs = [
  { q: 'What is StockFlow?', a: 'StockFlow brings point of sale, product inventory, stock movements and business reporting into one retail workspace.' },
  { q: 'Who is StockFlow for?', a: 'StockFlow is designed for shop owners and teams who want a more organized way to record sales and manage inventory.' },
  { q: 'Can I scan barcodes?', a: 'StockFlow supports barcode-based product lookup and camera scanning workflows. Compatibility depends on your device and scanner.' },
  { q: 'Can I use it on a phone?', a: 'Yes. The landing page and product experience are designed to adapt to mobile and desktop screens.' },
  { q: 'Does it work offline?', a: 'Supported workflows can use local data and queued synchronization. Cloud syncing and some features need an internet connection.' },
  { q: 'How do I get started?', a: 'Create an account, set up your shop, add your products and start recording sales.' },
]

function ProductPreview() {
  return (
    <div className="sf-product-scene" aria-label="Illustrative StockFlow point of sale interface">
      <div className="sf-scene-label"><span className="sf-live-dot" /> A clearer view of your shop</div>
      <div className="sf-pos-window">
        <div className="sf-pos-topbar"><div className="sf-pos-brand"><span className="sf-brand-mark"><Package size={15} /></span> stockflow</div><span className="sf-pos-crumb">Workspace&nbsp; / &nbsp;Overview</span><span className="sf-pos-avatar">S</span></div>
        <div className="sf-pos-body">
          <aside className="sf-pos-sidebar"><span className="sf-pos-side-active"><ShoppingCart size={15} /> Point of sale</span><span><BarChart3 size={15} /> Overview</span><span><Package size={15} /> Products</span><span><Truck size={15} /> Suppliers</span><span><Users size={15} /> Customers</span><div className="sf-pos-side-bottom">Your shop, in focus.</div></aside>
          <div className="sf-pos-content"><div className="sf-pos-heading"><div><small>MONDAY, YOUR SHOP AT A GLANCE</small><h3>Good morning.</h3><p>Here’s a snapshot of your business.</p></div><span className="sf-pos-date">Today <ChevronDown size={12} /></span></div>
            <div className="sf-pos-stats"><div><small>Sales today</small><strong>TSh 486,000</strong><span className="sf-stat-note">Daily total · sample data</span></div><div><small>Transactions</small><strong>38</strong><span className="sf-stat-note">Recorded today</span></div><div><small>Stock to review</small><strong>06 <em>items</em></strong><span className="sf-stat-note">At reorder level</span></div></div>
            <div className="sf-pos-lower"><div className="sf-pos-chart-card"><div className="sf-pos-card-title"><b>Sales activity</b><span>This week⌄</span></div><div className="sf-pos-total">TSh 2.84M <small>sample</small></div><div className="sf-pos-chart"><div className="sf-chart-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 76 C30 72 38 48 65 60 S102 76 130 47 S170 63 198 38 S236 52 266 28 S304 42 333 20 S372 31 400 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></div><div className="sf-pos-week"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div>
              <div className="sf-pos-activity"><div className="sf-pos-card-title"><b>Recent activity</b><span>•••</span></div><div className="sf-pos-activity-row"><i className="sf-activity-blue"><ShoppingCart size={13}/></i><span><b>Sale recorded</b><small>Counter sale</small></span><strong>+48k</strong></div><div className="sf-pos-activity-row"><i className="sf-activity-sand"><Package size={13}/></i><span><b>Stock updated</b><small>Inventory record</small></span><strong>Done</strong></div><div className="sf-pos-activity-row"><i className="sf-activity-dark"><Check size={13}/></i><span><b>Daily record</b><small>Saved to workspace</small></span><strong>Saved</strong></div></div></div>
          </div>
        </div>
      </div>
      <div className="sf-scene-note"><span className="sf-note-check"><Check size={15}/></span><span><b>Everything in its place.</b><small>Sales · Products · Stock · Reports</small></span></div>
      <p className="sf-scene-caption">Illustrative interface · Sample figures</p>
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
      <div className="sf-announcement"><span className="sf-announcement-dot" /> A calmer way to manage your shop <ArrowRight size={13} /></div>
      <header className="sf-site-header">
        <div className="sf-nav-inner">
          <Link to="/" className="sf-wordmark" aria-label="StockFlow home" onClick={closeMenu}><span className="sf-brand-mark"><Package size={18} strokeWidth={2.2}/></span><span>stockflow<span className="sf-wordmark-period">.</span></span></Link>
          <nav className={'sf-nav-links ' + (menuOpen ? 'is-open' : '')} aria-label="Main navigation">
            <a href="#features" onClick={closeMenu}>What you can do</a><a href="#how-it-works" onClick={closeMenu}>How it works</a><a href="#businesses" onClick={closeMenu}>Who it’s for</a><a href="#faq" onClick={closeMenu}>FAQs</a>
            <div className="sf-mobile-nav-actions"><Link to="/login" onClick={closeMenu}>Sign in</Link><Link className="sf-button sf-button-primary" to={appPath} onClick={closeMenu}>{ctaLabel}<ArrowRight size={16}/></Link></div>
          </nav>
          <div className="sf-desktop-actions"><Link className="sf-signin" to="/login">Sign in</Link><Link className="sf-button sf-button-primary sf-nav-cta" to={appPath}>{ctaLabel}<ArrowRight size={16}/></Link></div>
          <button className="sf-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={22}/> : <Menu size={22}/>}</button>
        </div>
      </header>
      <main id="main-content">
        <section className="sf-hero">
          <div className="sf-hero-photo" aria-hidden="true"></div><div className="sf-hero-shade" aria-hidden="true"></div>
          <div className="sf-container sf-hero-layout">
            <div className="sf-hero-copy"><div className="sf-eyebrow"><span className="sf-eyebrow-line"></span> RETAIL POS & STOCK MANAGEMENT</div><h1>Know your shop.<br/><em>Run it better.</em></h1><p className="sf-hero-description">Sales, stock and everyday business records — brought together in one clear workspace.</p><div className="sf-hero-actions"><Link className="sf-button sf-button-primary sf-button-large" to={appPath}>{ctaLabel}<ArrowRight size={17}/></Link><a className="sf-hero-link" href="#features">Discover StockFlow <ArrowDownRight size={16}/></a></div><div className="sf-hero-points"><span><Check size={14}/> Sales and inventory together</span><span><Check size={14}/> Designed for everyday retail</span></div></div>
            <div className="sf-hero-visual"><ProductPreview/></div>
          </div>
          <div className="sf-hero-bottom"><span>LESS CLUTTER. MORE CLARITY.</span><span>BUILT FOR THE RHYTHM OF RETAIL <ArrowDownRight size={13}/></span></div>
        </section>
        <section className="sf-intro-strip"><div className="sf-container sf-intro-inner"><p>Good business starts with a clearer picture.</p><div><span><ShoppingCart size={16}/> Sales</span><span><Package size={16}/> Inventory</span><span><BarChart3 size={16}/> Reports</span><span><Smartphone size={16}/> Mobile ready</span></div></div></section>
        <section id="features" className="sf-section sf-features-section"><div className="sf-container"><div className="sf-section-heading"><div><span className="sf-section-kicker">THE EVERYDAY, MADE EASIER</span><h2>Everything you need.<br/><em>Nothing in the way.</em></h2></div><p>Running a shop is already full of moving parts. StockFlow keeps the essentials close, so your team can focus on the work in front of them.</p></div><div className="sf-feature-grid">{features.map(({icon:Icon,title,text},index)=><article className="sf-feature-card" key={title}><div className="sf-feature-top"><span className="sf-feature-icon"><Icon size={21} strokeWidth={1.6}/></span><span className="sf-feature-number">0{index+1}</span></div><h3>{title}</h3><p>{text}</p><span className="sf-feature-rule"></span></article>)}</div></div></section>
        <section id="how-it-works" className="sf-work-section"><div className="sf-container sf-work-layout"><div className="sf-work-intro"><span className="sf-section-kicker">A MORE NATURAL WORKFLOW</span><h2>From the first sale<br/>to <em>the bigger picture.</em></h2><p>Start with the products you sell. Record transactions as they happen. Then use the records you build to understand what needs attention.</p><Link className="sf-text-link" to={appPath}>{ctaLabel}<ArrowRight size={16}/></Link></div><div className="sf-steps"><article className="sf-step"><span className="sf-step-number">01</span><div><h3>Bring your products together</h3><p>Keep names, prices and quantities organized in one catalogue.</p></div><span className="sf-step-icon"><Package size={20}/></span></article><article className="sf-step"><span className="sf-step-number">02</span><div><h3>Keep each sale connected</h3><p>Record transactions and keep stock movements tied to daily activity.</p></div><span className="sf-step-icon"><ShoppingCart size={20}/></span></article><article className="sf-step"><span className="sf-step-number">03</span><div><h3>See what deserves attention</h3><p>Review your records and make decisions with a clearer view of the shop.</p></div><span className="sf-step-icon"><BarChart3 size={20}/></span></article></div></div></section>
        <section id="businesses" className="sf-business-section"><div className="sf-container"><div className="sf-business-heading"><div><span className="sf-section-kicker">MADE FOR REAL RETAIL</span><h2>One shop at a time.<br/><em>One clearer picture.</em></h2></div><p>From the neighbourhood shop to a growing retail team, keep your everyday operations in better order.</p></div><div className="sf-business-grid"><article className="sf-business-card sf-business-card-photo"><div className="sf-business-photo sf-business-photo-one"></div><div><span>01 / DAILY SALES</span><h3>General retail</h3><p>Keep the counter moving and transactions organized.</p></div></article><article className="sf-business-card"><div className="sf-business-symbol"><ShoppingBag size={24}/></div><div><span>02 / PRODUCT CONTROL</span><h3>Minimarkets</h3><p>Keep product quantities and stock movement in view.</p></div></article><article className="sf-business-card"><div className="sf-business-symbol"><ScanBarcode size={24}/></div><div><span>03 / QUICK LOOKUP</span><h3>Electronics & accessories</h3><p>Find items and maintain clearer product records.</p></div></article></div></div></section>
        <section className="sf-quote-section"><div className="sf-container sf-quote-inner"><span className="sf-quote-mark">“</span><blockquote>When the records are clear, the next decision gets easier.</blockquote><p>STOCKFLOW · YOUR SHOP, IN BETTER ORDER</p></div></section>
        <section id="faq" className="sf-section sf-faq-section"><div className="sf-container sf-faq-layout"><div className="sf-faq-intro"><span className="sf-section-kicker">GOOD TO KNOW</span><h2>Questions,<br/><em>answered.</em></h2><p>A few things you might want to know before getting started.</p><div className="sf-faq-help"><CircleHelp size={18}/><span>Ready to take a look?<small>Open StockFlow and explore your workspace.</small></span></div></div><div className="sf-faq-list">{faqs.map((faq,index)=><article className={'sf-faq-item ' + (openFaq===index?'is-open':'')} key={faq.q}><h3><button type="button" aria-expanded={openFaq===index} onClick={()=>setOpenFaq(openFaq===index?null:index)}>{faq.q}<ChevronDown size={18}/></button></h3><p hidden={openFaq!==index}>{faq.a}</p></article>)}</div></div></section>
        <section className="sf-final-cta"><div className="sf-container sf-final-cta-inner"><div><span className="sf-section-kicker sf-kicker-light">MAKE ROOM FOR A CLEARER DAY</span><h2>Your shop deserves<br/><em>a better overview.</em></h2><p>Bring sales, products and everyday records into one workspace.</p></div><div className="sf-final-actions"><Link className="sf-button sf-button-light sf-button-large" to={appPath}>{ctaLabel}<ArrowRight size={17}/></Link><span>No complicated setup to explore.</span></div></div></section>
      </main>
      <footer className="sf-footer"><div className="sf-container sf-footer-inner"><Link to="/" className="sf-wordmark"><span className="sf-brand-mark"><Package size={17}/></span><span>stockflow<span className="sf-wordmark-period">.</span></span></Link><p>Clearer records. Better-run shops.</p><div><a href="#features">Features</a><a href="#faq">FAQs</a><Link to="/login">Sign in</Link></div><small>© {new Date().getFullYear()} StockFlow. All rights reserved.</small></div></footer>
    </div>
  )
}
