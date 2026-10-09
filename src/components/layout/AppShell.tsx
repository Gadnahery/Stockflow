import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, Package, Users, BarChart3, LayoutGrid, LogOut, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { usePosStore } from '../../store/posStore'
import { useUi } from '../../store/uiStore'
import Toasts from '../ui/Toasts'

const navItems = [
  { to: '/', icon: ShoppingCart, label: 'POS', end: true },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/more', icon: LayoutGrid, label: 'More' },
]

/** "More" owns every secondary screen (sales, shifts, settings…) */
function activeIndex(pathname: string) {
  if (pathname === '/') return 0
  if (pathname.startsWith('/products')) return 1
  if (pathname.startsWith('/customers')) return 2
  if (pathname.startsWith('/reports')) return 3
  return 4
}

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isOnline, pendingSyncCount, cart } = usePosStore()
  const tabCompact = useUi((s) => s.tabCompact)
  const [userName, setUserName] = useState('User')
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const active = activeIndex(location.pathname)

  useEffect(() => {
    const raw = sessionStorage.getItem('currentUser')
    if (!raw) {
      navigate('/login')
      return
    }
    try {
      const u = JSON.parse(raw)
      setUserName(u.name || 'User')
    } catch {
      navigate('/login')
    }
  }, [navigate])

  const lock = () => {
    sessionStorage.removeItem('currentUser')
    navigate('/login')
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-surface-secondary">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col glass border-r border-black/5 shrink-0">
        <div className="px-6 pt-7 pb-5">
          <h1 className="text-[22px] font-bold tracking-tight text-ink">StockFlow</h1>
          <p className="text-[13px] text-ink-muted mt-0.5">{userName}</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item, i) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={clsx(
                'flex items-center gap-3 px-3.5 h-11 rounded-[14px] text-[15px] font-medium transition-smooth',
                active === i ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-black/[0.04] hover:text-ink'
              )}
            >
              <item.icon size={20} strokeWidth={active === i ? 2.4 : 1.9} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 space-y-2">
          <div
            className={clsx(
              'flex items-center gap-2 text-[13px] font-medium px-3.5 h-10 rounded-[14px]',
              isOnline ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'
            )}
          >
            {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
            {isOnline ? 'Online' : 'Offline'}
            {pendingSyncCount > 0 && <span className="ml-auto tabular-nums">{pendingSyncCount} pending</span>}
          </div>
          <button
            onClick={lock}
            className="w-full flex items-center gap-3 px-3.5 h-11 rounded-[14px] text-[15px] text-ink-secondary hover:bg-black/[0.04] hover:text-ink transition-smooth"
          >
            <LogOut size={19} />
            Lock screen
          </button>
        </div>
      </aside>

      {/* Main content — keyed so each screen eases in */}
      <main className="flex-1 min-h-0 min-w-0 relative">
        <div key={location.pathname} className="page-enter h-full flex flex-col">
          <Outlet />
        </div>
      </main>

      {/* Mobile: content fades under a floating, translucent, rounded tab bar */}
      <div className="tab-fade" aria-hidden />
      <div className="tabbar-wrap">
        <nav className="tabbar" data-compact={tabCompact} aria-label="Main">
          <span className="tabbar-pill" style={{ transform: `translateX(${active * 100}%)` }} aria-hidden />
          {navItems.map((item, i) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-active={active === i}
              aria-label={item.label}
              className="tabbar-item"
            >
              <span className="relative">
                <item.icon size={23} strokeWidth={active === i ? 2.4 : 1.9} />
                {i === 0 && cartCount > 0 && (
                  <span key={cartCount} className="bump absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-[17px] text-center">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </span>
              <span className="tabbar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <Toasts />
    </div>
  )
}
