import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Package, Users, BarChart3,
  LayoutDashboard, LogOut, Wifi, WifiOff
} from 'lucide-react'
import { usePosStore } from '../../store/posStore'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: ShoppingCart, label: 'POS', end: true },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/more', icon: LayoutDashboard, label: 'More' },
]

export default function AppShell() {
  const navigate = useNavigate()
  const { isOnline, pendingSyncCount } = usePosStore()
  const [userName, setUserName] = useState('User')

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
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-border shrink-0">
        <div className="px-5 py-5 border-b border-border">
          <h1 className="text-xl font-semibold tracking-tight text-ink">StockFlow</h1>
          <p className="text-xs text-ink-muted mt-0.5">{userName}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-smooth',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-ink-secondary hover:bg-surface-secondary hover:text-ink'
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className={clsx(
            'flex items-center gap-2 text-xs px-3 py-2 rounded-button',
            isOnline ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'
          )}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? 'Online' : 'Offline'}
            {pendingSyncCount > 0 && (
              <span className="ml-auto font-medium">{pendingSyncCount}</span>
            )}
          </div>
          <button
            onClick={lock}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-sm text-ink-secondary hover:bg-surface-secondary hover:text-ink transition-smooth"
          >
            <LogOut size={18} />
            Lock Screen
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        <Outlet />
      </main>

      {/* Mobile bottom floating translucent nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bottom-nav
        bg-white/80 backdrop-blur-xl border-t border-border/50
        flex items-center justify-around px-2 pt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-smooth min-w-[64px]',
                isActive ? 'text-primary' : 'text-ink-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
