import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Barcode, Check, ChevronDown, CircleHelp,
  Cloud, Menu, Package, ScanLine, ShoppingCart, Smartphone, Truck,
  Users, WalletCards, X, WifiOff, Zap,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './LandingPage.css'

const capabilities = [
  { icon: ShoppingCart, title: 'Point of sale', text: 'Keep checkout clear and record each sale without losing track of the details.', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=85', alt: 'Shop owner handling a customer transaction' },
  { icon: Package, title: 'Stock management', text: 'Know what is in your shop, follow stock movements and spot items that need attention.', image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=900&q=85', alt: 'Carefully arranged retail products' },
  { icon: BarChart3, title: 'Reports that make sense', text: 'See sales activity and business performance in one place, ready to guide your next decision.', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=85', alt: 'Business performance charts on a screen' },
  { icon: Users, title: 'Customer records', text: 'Keep customer details and transaction history close to the everyday work of your shop.', image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=85', alt: 'Small business team working together' },
]

const benefits = [
  { icon: Barcode, title: 'Faster product lookup', text: 'Find items by searching or using supported barcode-scanning workflows.' },
  { icon: Truck, title: 'Suppliers and stock movement', text: 'Keep supplier information and inventory activity organized together.' },
  { icon: WalletCards, title: 'Sales and expenses', text: 'Track everyday money movement with records you can return to.' },
  { icon: WifiOff, title: 'Work through interruptions', text: 'Offline-first workflows keep supported tasks available when connectivity drops.' },
  { icon: Cloud, title: 'Sync when connected', text: 'Bring local changes back into sync when your connection is available.' },
  { icon: Smartphone, title: 'Ready for your devices', text: 'A responsive experience for the counter, the office or your phone.' },
]

const faqs = [
  { q: 'What is StockFlow?', a: 'StockFlow is a point-of-sale and stock-management workspace for retailers. It brings sales, products, stock movements, customers and reporting together.' },
  { q: 'Can I use StockFlow without internet?', a: 'StockFlow is designed with offline-first workflows. Some cloud features and synchronization require an internet connection.' },
  { q: 'Can I scan product barcodes?', a: 'Yes. StockFlow supports barcode-based product lookup and compatible scanning workflows, including device-camera options where supported.' },
  { q: 'Can I manage customers and suppliers?', a: 'Yes. Keep customer and supplier records connected to your shop operations.' },
  { q: 'Does StockFlow work on mobile and desktop?', a: 'The interface adapts to phone and desktop screens, and StockFlow also has a Windows desktop-app build.' },
  { q: 'How do I get started?', a: 'Create an account, set up your shop, add products and start recording sales.' },
]

function Brand() {
  return <Link to="/" className="sf-wordmark" aria-label="StockFlow home"><span className="sf-brand-symbol"><Package size={17} strokeWidth={2.2} /></span><span>stockflow<span className="sf-brand-dot">.</span></span></Link>
}

export default function LandingPage() {
  const { session, member } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const appPath = session && member ? '/pos' : '/signup'
  const ctaLabel = session && member ? 'Open StockFlow' : 'Get started'
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="sf-landing">
      <a className="sf-skip-link" href="#main-content">Skip to content</a>
      <header className="sf-site-header">
        <div className="sf-nav-inner">
          <Brand />
          <nav className={'sf-nav-links ' + (menuOpen ? 'is-open' : '')} aria-label="Main navigation">
            <a href="#features" onClick={closeMenu}>Features</a>
            <a href="#benefits" onClick={closeMenu}>Why StockFlow</a>
            <a href="#about" onClick={closeMenu}>For your shop</a>
            <a href="#faq" onClick={closeMenu}>FAQs</a>
            <div className="sf-mobile-nav-actions"><Link to="/login" onClick={closeMenu}>Sign in</Link><Link className="sf-button sf-button-primary" to={appPath} onClick={closeMenu}>{ctaLabel}<ArrowRight size={16}/></Link></div>
          </nav>
          <div className="sf-desktop-actions"><Link className="sf-signin" to="/login">Sign in</Link><Link className="sf-button sf-button-primary" to={appPath}>{ctaLabel}<ArrowRight size={16}/></Link></div>
          <button className="sf-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
        </div>
      </header>

      <main id="main-content">
        <section className="sf-hero">
          <div className="sf-hero-photo" aria-hidden="true" />
          <div className="sf-hero-overlay" aria-hidden="true" />
          <div className="sf-hero-content sf-container">
            <span className="sf-eyebrow"><i /> POINT OF SALE · STOCK MANAGEMENT</span>
            <h1>More control.<br/><em>Less guesswork.</em></h1>
            <p>Know what you sell, what you have and how your shop is doing — all from one clear workspace.</p>
            <div className="sf-hero-actions"><Link className="sf-button sf-button-white" to={appPath}>{ctaLabel}<ArrowRight size={16}/></Link><a className="sf-button sf-button-outline" href="#features">Explore features</a></div>
            <div className="sf-hero-trust"><span><Check size={13}/> Sales and stock together</span><span><Check size={13}/> Built for everyday retail</span></div>
          </div>
          <div className="sf-hero-bottom"><span>YOUR SHOP, IN BETTER ORDER</span><span>SCROLL TO EXPLORE <ChevronDown size={13}/></span></div>
        </section>

        <section className="sf-intro-section">
          <div className="sf-container sf-intro-layout"><span className="sf-kicker">A CLEARER WAY TO RUN RETAIL</span><h2>Your shop has a lot going on.<br/><em>Your system should make it simpler.</em></h2><p>From the first sale of the day to the stock you need to reorder, StockFlow helps bring the important details into view.</p></div>
        </section>

        <section id="features" className="sf-features-section">
          <div className="sf-container">
            <div className="sf-section-head"><div><span className="sf-kicker">WHAT YOU CAN DO</span><h2>Everything in its<br/><em>right place.</em></h2></div><p>Less time looking for information. More time serving customers and running your business.</p></div>
            <div className="sf-capability-grid">{capabilities.map(({icon:Icon,title,text,image,alt},i)=><article className={'sf-capability sf-capability-'+(i+1)} key={title}><div className="sf-capability-image"><img src={image} alt={alt} loading="lazy"/><span className="sf-capability-icon"><Icon size={19}/></span></div><div className="sf-capability-copy"><span className="sf-capability-count">0{i+1} / STOCKFLOW</span><h3>{title}</h3><p>{text}</p><a href="#benefits" aria-label={'Learn about '+title}>Explore feature <ArrowRight size={14}/></a></div></article>)}</div>
          </div>
        </section>

        <section id="benefits" className="sf-benefits-section">
          <div className="sf-container sf-benefits-layout">
            <div className="sf-benefits-intro"><span className="sf-kicker">MORE THAN A CHECKOUT</span><h2>Small details.<br/><em>Real difference.</em></h2><p>Running a shop is about much more than taking payment. StockFlow helps you stay on top of the work around every sale, too.</p><Link className="sf-text-link" to={appPath}>{ctaLabel}<ArrowRight size={15}/></Link></div>
            <div className="sf-benefit-list">{benefits.map(({icon:Icon,title,text},i)=><article className="sf-benefit-row" key={title}><span className="sf-benefit-icon"><Icon size={19}/></span><div><span className="sf-benefit-index">0{i+1}</span><h3>{title}</h3><p>{text}</p></div><ArrowRight className="sf-benefit-arrow" size={16}/></article>)}</div>
          </div>
        </section>

        <section id="about" className="sf-shop-section">
          <div className="sf-container sf-shop-layout"><div className="sf-shop-image"><img src="https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=1300&q=85" alt="Well-organized neighbourhood retail shop" loading="lazy"/><span className="sf-image-caption"><i/> MADE FOR THE DAY-TO-DAY</span></div><div className="sf-shop-copy"><span className="sf-kicker">MADE FOR REAL SHOPS</span><h2>Your business.<br/><em>Your way of working.</em></h2><p>Whether you run a minimarket, cosmetics shop, electronics store or general retail business, keep the essentials connected without adding complexity.</p><ul><li><Check size={15}/> One place for sales and products</li><li><Check size={15}/> Clearer stock records</li><li><Check size={15}/> Reports to help you plan ahead</li><li><Check size={15}/> A workflow that fits your devices</li></ul><Link className="sf-text-link" to={appPath}>See StockFlow for yourself <ArrowRight size={15}/></Link></div></div>
        </section>

        <section className="sf-proof-section"><div className="sf-container sf-proof-layout"><span className="sf-proof-mark">“</span><div><span className="sf-kicker">THE STOCKFLOW APPROACH</span><blockquote>When your records are clear, running your shop feels clearer too.</blockquote><p>SALES · STOCK · CUSTOMERS · REPORTS</p></div><div className="sf-proof-image"><img src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=85" alt="Retail business owner helping a customer" loading="lazy"/></div></div></section>

        <section id="faq" className="sf-faq-section"><div className="sf-container sf-faq-layout"><div className="sf-faq-intro"><span className="sf-kicker">GOOD TO KNOW</span><h2>Questions?<br/><em>We have answers.</em></h2><p>Everything you need to know before you start using StockFlow.</p><div className="sf-faq-help"><CircleHelp size={18}/><span>Ready to get started?<small>Set up your shop and explore the workspace.</small></span></div></div><div className="sf-faq-list">{faqs.map((faq,i)=><article className={'sf-faq-item '+(openFaq===i?'is-open':'')} key={faq.q}><h3><button type="button" aria-expanded={openFaq===i} onClick={()=>setOpenFaq(openFaq===i?null:i)}>{faq.q}<ChevronDown size={17}/></button></h3><p hidden={openFaq!==i}>{faq.a}</p></article>)}</div></div></section>

        <section className="sf-final-cta"><div className="sf-final-photo" aria-hidden="true"/><div className="sf-final-overlay" aria-hidden="true"/><div className="sf-final-content"><span className="sf-kicker sf-kicker-light">YOUR NEXT BUSINESS DECISION STARTS HERE</span><h2>Your shop is ready<br/>for <em>a clearer view.</em></h2><Link className="sf-button sf-button-white" to={appPath}>{ctaLabel}<ArrowRight size={16}/></Link></div></section>
      </main>

      <footer className="sf-footer"><div className="sf-container sf-footer-main"><div><Brand/><p>Know your shop. Run it better.</p></div><div className="sf-footer-links"><a href="#features">Features</a><a href="#benefits">Why StockFlow</a><a href="#faq">FAQs</a><Link to="/login">Sign in</Link></div><Link className="sf-footer-top" to="/">Back to top ↑</Link></div><div className="sf-container sf-footer-bottom"><span>© {new Date().getFullYear()} StockFlow. All rights reserved.</span><span>Point of sale & stock management</span></div></footer>
    </div>
  )
}
