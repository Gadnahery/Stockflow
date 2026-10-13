import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Package, Users, BarChart3, LayoutGrid, Lock, Wifi, WifiOff,
  PanelLeft, PanelLeftClose, Search, Plus, Receipt, Wallet, Truck, ClipboardList,
  Settings, CloudCog, ShieldCheck, CreditCard, Building2,
} from 'lucide-react'
import { useEffect, useRef, type UIEvent, type FocusEvent } from 'react'
import clsx from 'clsx'
import { usePosStore } from '../../store/posStore'
import { useUi, type SidebarMode } from '../../store/uiStore'
import { useAuth } from '../../contexts/AuthContext'
import Toasts from '../ui/Toasts'
import CommandPalette from '../CommandPalette'
import InstallBanner from '../InstallBanner'
import { useI18n } from '../i18n/I18nContext'
import type { MessageKey } from '../i18n/messages'

type NavItem = {
  to: string
  icon: typeof ShoppingCart
  label: string
  end?: boolean
  section?: string
}

const mobileNavKeys = [
  { to: '/pos', icon: ShoppingCart, labelKey: 'app.pos' as MessageKey, end: true },
  { to: '/products', icon: Package, labelKey: 'app.products' as MessageKey },
  { to: '/customers', icon: Users, labelKey: 'app.customers' as MessageKey },
  { to: '/reports', icon: BarChart3, labelKey: 'app.reports' as MessageKey },
  { to: '/more', icon: LayoutGrid, labelKey: 'app.more' as MessageKey },
]

const desktopNavKeys = [
  { to: '/home', icon: LayoutGrid, labelKey: 'app.home' as MessageKey, section: 'Sell' },
  { to: '/pos', icon: ShoppingCart, labelKey: 'app.pos' as MessageKey, end: true, section: 'Sell' },
  { to: '/sales', icon: Receipt, labelKey: 'app.sales' as MessageKey, section: 'Sell' },
  { to: '/products', icon: Package, labelKey: 'app.products' as MessageKey, section: 'Inventory' },
  { to: '/stock', icon: Package, labelKey: 'app.stock' as MessageKey, section: 'Inventory' },
  { to: '/suppliers', icon: Truck, labelKey: 'app.suppliers' as MessageKey, section: 'Inventory' },
  { to: '/customers', icon: Users, labelKey: 'app.customers' as MessageKey, section: 'People' },
  { to: '/users', icon: Users, labelKey: 'app.team' as MessageKey, section: 'People' },
  { to: '/expenses', icon: Wallet, labelKey: 'app.expenses' as MessageKey, section: 'Money' },
  { to: '/shifts', icon: ClipboardList, labelKey: 'app.shifts' as MessageKey, section: 'Money' },
  { to: '/reports', icon: BarChart3, labelKey: 'app.reports' as MessageKey, section: 'Insights' },
  { to: '/sync', icon: CloudCog, labelKey: 'app.sync' as MessageKey, section: 'Insights' },
  { to: '/notifications', icon: ShieldCheck, labelKey: 'app.alerts' as MessageKey, section: 'Insights' },
  { to: '/audit', icon: ShieldCheck, labelKey: 'app.audit' as MessageKey, section: 'Insights' },
  { to: '/branches', icon: Building2, labelKey: 'app.branches' as MessageKey, section: 'Admin' },
  { to: '/settings', icon: Settings, labelKey: 'app.settings' as MessageKey, section: 'Admin' },
  { to: '/billing', icon: CreditCard, labelKey: 'app.plan' as MessageKey, section: 'Admin' },
  { to: '/more', icon: LayoutGrid, labelKey: 'app.more' as MessageKey, section: 'Admin' },
]

function mobileActiveIndex(pathname: string) {
  if (pathname === '/pos') return 0
  if (pathname.startsWith('/products')) return 1
  if (pathname.startsWith('/customers')) return 2
  if (pathname.startsWith('/reports')) return 3
  return 4
}

function pageTitleKey(pathname: string): MessageKey | null {
  const hit = desktopNavKeys.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
  if (hit) return hit.labelKey
  if (pathname.startsWith('/account')) return 'app.account'
  if (pathname.startsWith('/help')) return 'app.help'
  if (pathname.startsWith('/branches')) return 'app.branches'
  if (pathname.startsWith('/billing')) return 'app.plan'
  return null
}

const SIDEBAR_W: Record<SidebarMode, string> = {
  expanded: 'w-[260px]',
  rail: 'w-[72px]',
  hidden: 'w-0',
}

export default function AppShell() {
  const { t } = useI18n()
  const location = useLocation()
  const mobileNav = mobileNavKeys.map((n) => ({ ...n, label: t(n.labelKey) }))
  const desktopNav = desktopNavKeys.map((n) => ({ ...n, label: t(n.labelKey) }))
  const titleKey = pageTitleKey(location.pathname)
  const pageHeading = titleKey ? t(titleKey) : 'StockFlow'

  const navigate = useNavigate()
  const { isOnline, pendingSyncCount, cart } = usePosStore()
  const tabCompact = useUi((s) => s.tabCompact)
  const tabHidden = useUi((s) => s.tabHidden)
  const setTabCompact = useUi((s) => s.setTabCompact)
  const setTabHidden = useUi((s) => s.setTabHidden)
  const sidebarMode = useUi((s) => s.sidebarMode)
  const setSidebarMode = useUi((s) => s.setSidebarMode)
  const cycleSidebar = useUi((s) => s.cycleSidebar)
  const setCommandOpen = useUi((s) => s.setCommandOpen)
  const { member, business, lockWithPin, touchActivity } = useAuth()
  const lastTops = useRef(new WeakMap<EventTarget, number>())
  const blurTimer = useRef<ReturnType<typeof setTimeout>>()
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const active = mobileActiveIndex(location.pathname)
  const userName = member?.display_name || business?.name || 'User'
  const title = pageHeading
  const expanded = sidebarMode === 'expanded'
  const rail = sidebarMode === 'rail'
  const hidden = sidebarMode === 'hidden'

  useEffect(() => {
    const onAct = () => touchActivity()
    window.addEventListener('pointerdown', onAct)
    window.addEventListener('keydown', onAct)
    return () => {
      window.removeEventListener('pointerdown', onAct)
      window.removeEventListener('keydown', onAct)
    }
  }, [touchActivity])

  // Ctrl/Cmd+B toggles sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        cycleSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleSidebar])

  // Auto rail on medium widths
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => {
      if (!mq.matches && sidebarMode === 'expanded') {
        // leave user preference; only soft-suggest on first load is optional
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [sidebarMode])

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

  // Group desktop nav by section
  const sections: { name: string; items: NavItem[] }[] = []
  for (const item of desktopNav) {
    const sec = item.section || 'Other'
    const last = sections[sections.length - 1]
    if (!last || last.name !== sec) sections.push({ name: sec, items: [item] })
    else last.items.push(item)
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-surface-secondary" onFocus={onFocusIn} onBlur={onFocusOut}>
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden md:flex flex-col glass border-r border-black/5 shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          SIDEBAR_W[sidebarMode],
        )}
      >
        {!hidden && (
          <>
            <div className={clsx('pt-6 pb-4', expanded ? 'px-5' : 'px-2')}>
              {expanded ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h1 className="text-[20px] font-bold tracking-tight text-ink truncate">StockFlow</h1>
                    <button
                      type="button"
                      onClick={() => setSidebarMode('rail')}
                      className="press h-8 w-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-black/[0.05]"
                      title="Collapse sidebar (⌘B)"
                      aria-label="Collapse sidebar"
                    >
                      <PanelLeftClose size={18} />
                    </button>
                  </div>
                  <p className="text-[12px] text-ink-muted mt-0.5 truncate">{userName}</p>
                  {business?.name && (
                    <p className="text-[11px] text-ink-muted truncate">{business.name}</p>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSidebarMode('expanded')}
                  className="press mx-auto h-10 w-10 rounded-[12px] bg-primary text-white flex items-center justify-center"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft size={18} />
                </button>
              )}
            </div>

            <nav className={clsx('flex-1 overflow-y-auto no-scrollbar', expanded ? 'px-2.5' : 'px-1.5')}>
              {sections.map((sec) => (
                <div key={sec.name} className="mb-3">
                  {expanded && (
                    <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      {sec.name}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
                      const isActive = item.end
                        ? location.pathname === item.to
                        : location.pathname.startsWith(item.to)
                      return (
                        <NavLink
                          key={item.to + item.label}
                          to={item.to}
                          end={item.end}
                          title={rail ? item.label : undefined}
                          className={clsx(
                            'flex items-center rounded-[12px] text-[14px] font-medium transition-smooth',
                            expanded ? 'gap-3 px-3 h-10' : 'justify-center h-11 w-11 mx-auto',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-ink-secondary hover:bg-black/[0.04] hover:text-ink',
                          )}
                        >
                          <item.icon size={expanded ? 18 : 20} strokeWidth={isActive ? 2.4 : 1.9} />
                          {expanded && <span className="truncate">{item.label}</span>}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className={clsx('p-2.5 space-y-1.5 border-t border-black/5', !expanded && 'flex flex-col items-center')}>
              <div
                className={clsx(
                  'flex items-center gap-2 text-[12px] font-medium rounded-[12px]',
                  expanded ? 'px-3 h-9' : 'h-10 w-10 justify-center',
                  isOnline ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning',
                )}
                title={isOnline ? 'Online' : 'Offline'}
              >
                {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
                {expanded && (
                  <>
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                    {pendingSyncCount > 0 && (
                      <span className="ml-auto tabular-nums">{pendingSyncCount}</span>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => lockWithPin()}
                title="Lock screen"
                className={clsx(
                  'flex items-center rounded-[12px] text-[14px] text-ink-secondary hover:bg-black/[0.04] hover:text-ink transition-smooth',
                  expanded ? 'w-full gap-3 px-3 h-10' : 'h-10 w-10 justify-center',
                )}
              >
                <Lock size={18} />
                {expanded && 'Lock'}
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Desktop top bar */}
        <header className="hidden md:flex items-center gap-3 h-14 px-4 lg:px-5 border-b border-black/5 bg-white/80 backdrop-blur-xl shrink-0 z-20">
          {hidden && (
            <button
              type="button"
              onClick={() => setSidebarMode('expanded')}
              className="press h-9 w-9 rounded-lg flex items-center justify-center text-ink-secondary hover:bg-black/[0.05]"
              aria-label="Show sidebar"
            >
              <PanelLeft size={18} />
            </button>
          )}
          {rail && (
            <button
              type="button"
              onClick={() => setSidebarMode('hidden')}
              className="press h-9 w-9 rounded-lg flex items-center justify-center text-ink-muted hover:bg-black/[0.05]"
              title="Hide sidebar"
              aria-label="Hide sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink truncate">{title}</p>
          </div>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="press hidden lg:flex items-center gap-2 h-9 min-w-[200px] px-3 rounded-full bg-black/[0.05] text-ink-muted text-[13px] hover:bg-black/[0.07]"
          >
            <Search size={15} />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[10px] font-semibold bg-white/80 px-1.5 py-0.5 rounded border border-black/5">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="press lg:hidden h-9 w-9 rounded-lg flex items-center justify-center text-ink-secondary hover:bg-black/[0.05]"
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="press h-9 px-3.5 rounded-full bg-primary text-white text-[13px] font-semibold flex items-center gap-1.5 shadow-soft"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">New sale</span>
          </button>

          <button
            type="button"
            onClick={() => lockWithPin()}
            className="press h-9 w-9 rounded-lg flex items-center justify-center text-ink-secondary hover:bg-black/[0.05]"
            aria-label="Lock"
            title="Lock screen"
          >
            <Lock size={17} />
          </button>

          <button
            type="button"
            onClick={() => navigate('/account')}
            className="press h-9 w-9 rounded-full bg-gradient-to-br from-[#3395FF] to-[#0062CC] text-white text-[13px] font-bold flex items-center justify-center"
            title={userName}
            aria-label="Account"
          >
            {userName.charAt(0).toUpperCase()}
          </button>
        </header>

        <main className="flex-1 min-h-0 min-w-0 relative" onScrollCapture={onScrollAny}>
          <div key={location.pathname} className="page-enter h-full flex flex-col">
            <Outlet />
      <InstallBanner />
          </div>
        </main>
      </div>

      {/* Mobile tab bar */}
      <div className="tab-fade md:hidden" data-hidden={tabHidden} aria-hidden />
      <div className="tabbar-wrap md:hidden">
        <nav className="tabbar" data-compact={tabCompact} data-hidden={tabHidden} aria-label="Main">
          <span className="tabbar-pill" style={{ transform: `translateX(${active * 100}%)` }} aria-hidden />
          {mobileNav.map((item, i) => (
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

      <CommandPalette />
      <Toasts />
    </div>
  )
}
