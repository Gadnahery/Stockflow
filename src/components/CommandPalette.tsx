import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, Package, Users, BarChart3, Receipt, Settings, Wallet, Truck, ClipboardList, UserCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useUi } from '../store/uiStore'

type Item = {
  id: string
  label: string
  hint?: string
  icon: typeof Search
  action: () => void
  group: string
}

export default function CommandPalette() {
  const open = useUi((s) => s.commandOpen)
  const setOpen = useUi((s) => s.setCommandOpen)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const products = useLiveQuery(() => (open ? db.products.filter((p) => p.active).limit(80).toArray() : []), [open]) || []
  const customers = useLiveQuery(() => (open ? db.customers.orderBy('name').limit(40).toArray() : []), [open]) || []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useUi.getState().commandOpen)
      }
      if (e.key === 'Escape' && useUi.getState().commandOpen) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const items = useMemo(() => {
    const nav: Item[] = [
      { id: 'nav-pos', label: 'New sale / POS', icon: ShoppingCart, group: 'Go to', action: () => navigate('/') },
      { id: 'nav-products', label: 'Products', icon: Package, group: 'Go to', action: () => navigate('/products') },
      { id: 'nav-customers', label: 'Customers', icon: Users, group: 'Go to', action: () => navigate('/customers') },
      { id: 'nav-sales', label: 'Sales history', icon: Receipt, group: 'Go to', action: () => navigate('/sales') },
      { id: 'nav-reports', label: 'Reports', icon: BarChart3, group: 'Go to', action: () => navigate('/reports') },
      { id: 'nav-shifts', label: 'Cash shifts', icon: ClipboardList, group: 'Go to', action: () => navigate('/shifts') },
      { id: 'nav-expenses', label: 'Expenses', icon: Wallet, group: 'Go to', action: () => navigate('/expenses') },
      { id: 'nav-suppliers', label: 'Suppliers', icon: Truck, group: 'Go to', action: () => navigate('/suppliers') },
      { id: 'nav-settings', label: 'Settings', icon: Settings, group: 'Go to', action: () => navigate('/settings') },
      { id: 'nav-account', label: 'Account', icon: UserCircle, group: 'Go to', action: () => navigate('/account') },
    ]

    const ql = q.trim().toLowerCase()
    const match = (s: string) => !ql || s.toLowerCase().includes(ql)

    const productItems: Item[] = products
      .filter((p) => match(p.name) || match(p.sku) || (p.barcode && match(p.barcode)))
      .slice(0, 8)
      .map((p) => ({
        id: `p-${p.id}`,
        label: p.name,
        hint: `${p.sku} · ${Math.round(p.price).toLocaleString()} TZS`,
        icon: Package,
        group: 'Products',
        action: () => navigate('/products'),
      }))

    const customerItems: Item[] = customers
      .filter((c) => match(c.name) || (c.phone && match(c.phone)))
      .slice(0, 6)
      .map((c) => ({
        id: `c-${c.id}`,
        label: c.name,
        hint: c.phone || c.email || undefined,
        icon: Users,
        group: 'Customers',
        action: () => navigate('/customers'),
      }))

    return [
      ...nav.filter((n) => match(n.label)),
      ...productItems,
      ...customerItems,
    ]
  }, [q, products, customers, navigate])

  useEffect(() => {
    setActive(0)
  }, [q])

  if (!open) return null

  const run = (item: Item) => {
    setOpen(false)
    item.action()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault()
      run(items[active])
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'rgba(0,0,0,0.32)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        className="w-full max-w-[560px] rounded-[20px] bg-white shadow-float overflow-hidden page-enter"
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 px-4 border-b border-border h-14">
          <Search size={18} className="text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, products, customers…"
            className="flex-1 h-full outline-none text-[16px] bg-transparent"
          />
          <kbd className="hidden sm:inline text-[11px] font-semibold text-ink-muted bg-black/[0.05] px-1.5 py-0.5 rounded">esc</kbd>
        </div>
        <ul className="max-h-[min(420px,50vh)] overflow-y-auto py-2">
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-[14px] text-ink-muted">No matches</li>
          )}
          {items.map((item, i) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => run(item)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${
                    i === active ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-black/[0.03]'
                  }`}
                >
                  <Icon size={18} strokeWidth={2} className="shrink-0 opacity-80" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium truncate">{item.label}</span>
                    {item.hint && (
                      <span className={`block text-[12px] truncate ${i === active ? 'text-primary/80' : 'text-ink-muted'}`}>
                        {item.hint}
                      </span>
                    )}
                  </span>
                  <span className={`text-[11px] font-semibold shrink-0 ${i === active ? 'text-primary/70' : 'text-ink-muted'}`}>
                    {item.group}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="px-4 py-2 border-t border-border text-[11px] text-ink-muted flex gap-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
