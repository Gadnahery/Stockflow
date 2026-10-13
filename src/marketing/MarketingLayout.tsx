import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const nav = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/resources', label: 'Resources' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function MarketingLayout() {
  const [open, setOpen] = useState(false)
  const year = new Date().getFullYear()

  return (
    <div className="min-h-full bg-white text-ink flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 h-14 md:h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-[17px] tracking-tight shrink-0">
            <span className="h-8 w-8 rounded-[10px] bg-primary text-white flex items-center justify-center text-[13px] font-bold">
              SF
            </span>
            StockFlow
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-full text-[14px] font-semibold ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:text-ink'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/login"
              className="hidden sm:inline-flex h-9 px-3 rounded-full text-[14px] font-semibold text-ink-secondary hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              to="/contact"
              className="press h-9 px-4 rounded-full bg-primary text-white text-[14px] font-semibold"
            >
              Book a Demo
            </Link>
            <button
              type="button"
              className="md:hidden press h-9 w-9 rounded-full bg-black/[0.05] flex items-center justify-center"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block px-3 py-3 rounded-[12px] text-[15px] font-semibold text-ink hover:bg-surface-secondary"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block px-3 py-3 rounded-[12px] text-[15px] font-semibold text-ink-secondary"
            >
              Sign in
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface-secondary">
        <div className="mx-auto max-w-6xl px-4 py-12 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-[16px]">
              <span className="h-8 w-8 rounded-[10px] bg-primary text-white flex items-center justify-center text-[12px]">
                SF
              </span>
              StockFlow
            </div>
            <p className="mt-3 text-[14px] text-ink-secondary leading-relaxed">
              Retail POS and inventory software for everyday shop operations in Tanzania and East
              Africa.
            </p>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Product</p>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li>
                <Link to="/features" className="text-ink-secondary hover:text-primary">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-ink-secondary hover:text-primary">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-ink-secondary hover:text-primary">
                  Create account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Resources</p>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li>
                <Link to="/resources" className="text-ink-secondary hover:text-primary">
                  Guides
                </Link>
              </li>
              <li>
                <Link to="/industries/retail-shops" className="text-ink-secondary hover:text-primary">
                  Retail shops
                </Link>
              </li>
              <li>
                <Link to="/industries/minimarkets" className="text-ink-secondary hover:text-primary">
                  Minimarkets
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Company</p>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li>
                <Link to="/about" className="text-ink-secondary hover:text-primary">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-ink-secondary hover:text-primary">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-ink-secondary hover:text-primary">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-ink-secondary hover:text-primary">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-4 text-center text-[13px] text-ink-muted">
          © {year} StockFlow. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
