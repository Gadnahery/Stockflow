import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfDay, endOfDay, format } from 'date-fns'
import {
  ShoppingCart, Package, Users, TrendingUp, AlertTriangle, CloudOff, Cloud, ChevronRight,
} from 'lucide-react'
import { db } from '../lib/db'
import Screen from '../components/ui/Screen'
import { usePosStore } from '../store/posStore'
import { useAuth } from '../contexts/AuthContext'
import BranchFilter from '../components/BranchFilter'
import { matchBranch } from '../hooks/useBranches'
import { getBranchId } from '../lib/supabase'
import { fmt, fmtMoney } from '../lib/util'

export default function DashboardPage() {
  const { business, member } = useAuth()
  const isOnline = usePosStore((s) => s.isOnline)
  const [branchFilter, setBranchFilter] = useState<string>(getBranchId() || 'all')
  const pendingSyncCount = usePosStore((s) => s.pendingSyncCount)

  const sales = useLiveQuery(() => db.sales.where('status').equals('completed').toArray(), [])
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), [])
  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])

  const today = useMemo(() => {
    const list = sales || []
    const a = startOfDay(new Date())
    const b = endOfDay(new Date())
    const cur = list.filter((s) => {
      const d = new Date(s.createdAt)
      if (d < a || d > b) return false
      return matchBranch(s.branchId, branchFilter)
    })
    const revenue = cur.reduce((t, s) => t + s.total, 0)
    const units = cur.reduce((t, s) => t + s.items.reduce((u, i) => u + i.quantity, 0), 0)
    return { orders: cur.length, revenue, units }
  }, [sales, branchFilter])

  const low = useMemo(
    () => (products || []).filter((p) => {
      if (p.stock > (p.minStock ?? 0)) return false
      if (branchFilter === 'all') return true
      return !p.branchId || p.branchId === branchFilter
    }),
    [products, branchFilter],
  )
  const credit = useMemo(
    () => (customers || []).reduce((t, c) => t + Math.max(0, c.balance), 0),
    [customers],
  )
  const todayExp = useMemo(() => {
    const a = startOfDay(new Date())
    const b = endOfDay(new Date())
    return (expenses || [])
      .filter((e) => {
        const d = new Date(e.createdAt)
        if (d < a || d > b) return false
        return matchBranch((e as { branchId?: string }).branchId, branchFilter)
      })
      .reduce((t, e) => t + e.amount, 0)
  }, [expenses, branchFilter])

  return (
    <Screen
      title="Home"
      subtitle={business?.name || 'Your shop today'}
    >
      <div className="px-4 pt-2">
        <BranchFilter value={branchFilter} onChange={setBranchFilter} />
      </div>
      <div className="space-y-4 md:max-w-2xl pb-8">
        <div className="flex items-center gap-2 text-[13px]">
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 text-success font-semibold">
              <Cloud size={15} /> Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-warning font-semibold">
              <CloudOff size={15} /> Offline — sales still work
            </span>
          )}
          {pendingSyncCount > 0 && (
            <Link to="/sync" className="text-primary font-semibold">
              {pendingSyncCount} to sync
            </Link>
          )}
          <span className="text-ink-muted ml-auto">{format(new Date(), 'EEE d MMM')}</span>
        </div>

        <div className="rounded-[22px] bg-gradient-to-br from-[#007AFF] to-[#0055CC] text-white p-5 shadow-float">
          <p className="text-[13px] font-semibold opacity-90">Today’s sales</p>
          <p className="text-[32px] font-bold tabular-nums tracking-tight mt-1">
            {fmt(today.revenue)}
            <span className="text-[14px] font-semibold opacity-80 ml-1">TZS</span>
          </p>
          <p className="text-[13px] opacity-90 mt-1">
            {today.orders} orders · {fmt(today.units)} units
          </p>
          <Link
            to="/pos"
            className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-primary font-semibold text-[14px]"
          >
            <ShoppingCart size={16} /> New sale
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Kpi to="/expenses" label="Expenses today" value={fmtMoney(todayExp)} />
          <Kpi to="/customers" label="Credit owed" value={fmtMoney(credit)} />
          <Kpi to="/products" label="Products" value={String(products?.length ?? '—')} />
          <Kpi
            to="/stock"
            label="Low stock"
            value={String(low.length)}
            warn={low.length > 0}
          />
        </div>

        {low.length > 0 && (
          <Link to="/stock" className="flex items-center gap-3 rounded-[18px] bg-amber-50 px-4 py-3.5">
            <AlertTriangle className="text-warning shrink-0" size={20} />
            <span className="flex-1 text-[14px] font-semibold text-warning">
              {low.length} product{low.length === 1 ? '' : 's'} need restock
            </span>
            <ChevronRight size={16} className="text-warning" />
          </Link>
        )}

        <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
          {[
            { to: '/reports', icon: TrendingUp, label: 'Reports & P&L', desc: 'Revenue, net profit, mix' },
            { to: '/sales', icon: ShoppingCart, label: 'Sales history', desc: 'Receipts and voids' },
            { to: '/products', icon: Package, label: 'Products', desc: 'Catalogue and stock' },
            { to: '/customers', icon: Users, label: 'Customers', desc: 'Credit and contacts' },
          ].map((item, i, arr) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="h-10 w-10 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center">
                <item.icon size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">{item.label}</span>
                <span className="block text-[12px] text-ink-muted">{item.desc}</span>
              </span>
              <ChevronRight size={16} className="text-ink-muted" />
            </Link>
          ))}
        </div>

        <p className="text-[12px] text-ink-muted text-center px-4">
          Signed in as {member?.display_name || member?.role || 'staff'}. Works offline on this device;
          install from the browser menu for a home-screen app.
        </p>
      </div>
    </Screen>
  )
}

function Kpi({
  label,
  value,
  to,
  warn,
}: {
  label: string
  value: string
  to: string
  warn?: boolean
}) {
  return (
    <Link to={to} className="rounded-[18px] bg-white shadow-card p-4 block">
      <p className="text-[12px] font-medium text-ink-muted">{label}</p>
      <p className={`text-[18px] font-bold tabular-nums mt-0.5 ${warn ? 'text-warning' : ''}`}>
        {value}
      </p>
    </Link>
  )
}
