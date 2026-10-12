import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ShoppingCart, Package, Users, BarChart3, LayoutGrid, Lock, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, type UIEvent, type FocusEvent } from 'react'
import clsx from 'clsx'
import { usePosStore } from '../../store/posStore'
import { useUi } from '../../store/uiStore'
import { useAuth } from '../../contexts/AuthContext'
import Toasts from '../ui/Toasts'

const navItems = [
  { to: '/', icon: ShoppingCart, label: 'POS', end: true },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/more', icon: LayoutGrid, label: 'More' },
]

function activeIndex(pathname: string) {
  if (pathname === '/') return 0
  if (pathname.startsWith('/products')) return 1
  if (pathname.startsWith('/customers')) return 2
  if (pathname.startsWith('/reports')) return 3
  return 4
}

export default function AppShell() {
  const location = useLocation()
  const { isOnline, pendingSyncCount, cart } = usePosStore()
  const tabCompact = useUi((s) => s.tabCompact)
  const tabHidden = useUi((s) => s.tabHidden)
  const setTabCompact = useUi((s) => s.setTabCompact)
  const setTabHidden = useUi((s) => s.setTabHidden)
  const { member, business, lockWithPin, touchActivity } = useAuth()
  const lastTops = useRef(new WeakMap<EventTarget, number>())
  const blurTimer = useRef<ReturnType<typeof setTimeout>>()
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const active = activeIndex(location.pathname)
  const userName = member?.display_name || business?.name || 'User'

  // Track activity for idle PIN lock
  useEffect(() => {
    const onAct = () => touchActivity()
    window.addEventListener('pointerdown', onAct)
    window.addEventListener('keydown', onAct)
    return () => {
      window.removeEventListener('pointerdown', onAct)
      window.removeEventListener('keydown', onAct)
    }
  }, [touchActivity])

  const onScrollAny = (e: UIEvent<HTMLElement>) => {
    const el = e.target as HTMLElement
    const top = el.scrollTop
    const last = lastTops.current.get(el) ?? 0
    const delta = top - last
    if (top < 60) setTabCompact(false)
    else if (delta > 8) setTabCompact(true)
    else if (delta < -8) setTabCompact(false)
    lastTops.current.set(el, top)
  }
  const isField = (t: EventTarget) => ['INPUT', 'SELECT', 'TEXTAREA'].includes((t as HTMLElement).tagName)
  const onFocusIn = (e: FocusEvent) => {
    if (isField(e.target)) {
      clearTimeout(blurTimer.current)
      setTabHidden(true)
    }
  }
  const onFocusOut = (e: FocusEvent) => {
    if (isField(e.target)) {
      blurTimer.current = setTimeout(() => setTabHidden(false), 150)
    }
  }
  useEffect(() => {
    setTabCompact(false)
    setTabHidden(false)
  }, [location.pathname, setTabCompact, setTabHidden])

  return (
    <div className="h-full flex flex-col md:flex-row bg-surface-secondary" onFocus={onFocusIn} onBlur={onFocusOut}>
      <aside className="hidden md:flex w-64 flex-col glass border-r border-black/5 shrink-0">
        <div className="px-6 pt-7 pb-5">
          <h1 className="text-[22px] font-bold tracking-tight text-ink">StockFlow</h1>
          <p className="text-[13px] text-ink-muted mt-0.5 truncate">{userName}</p>
          {business?.name && (
            <p className="text-[12px] text-ink-muted truncate">{business.name}</p>
          )}
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
            type="button"
            onClick={() => lockWithPin()}
            className="w-full flex items-center gap-3 px-3.5 h-11 rounded-[14px] text-[15px] text-ink-secondary hover:bg-black/[0.04] hover:text-ink transition-smooth"
          >
            <Lock size={19} />
            Lock screen
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-0 min-w-0 relative" onScrollCapture={onScrollAny}>
        <div key={location.pathname} className="page-enter h-full flex flex-col">
          <Outlet />
        </div>
      </main>

      <div className="tab-fade" data-hidden={tabHidden} aria-hidden />
      <div className="tabbar-wrap">
        <nav className="tabbar" data-compact={tabCompact} data-hidden={tabHidden} aria-label="Main">
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
