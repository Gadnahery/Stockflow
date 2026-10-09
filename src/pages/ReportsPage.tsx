import { type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { TrendingUp, ShoppingBag, Package, AlertTriangle } from 'lucide-react'

export default function ReportsPage() {
  const sales = useLiveQuery(() => db.sales.where('status').equals('completed').toArray(), []) || []
  const products = useLiveQuery(() => db.products.toArray(), []) || []

  const today = new Date()
  const todaySales = sales.filter((s) => {
    const d = new Date(s.createdAt)
    return d >= startOfDay(today) && d <= endOfDay(today)
  })
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
  const todayCount = todaySales.length

  const lowStock = products.filter((p) => p.stock <= (p.minStock || 0))

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(today, 6 - i)
    const daySales = sales.filter((s) => {
      const d = new Date(s.createdAt)
      return d >= startOfDay(day) && d <= endOfDay(day)
    })
    return {
      label: format(day, 'EEE'),
      revenue: daySales.reduce((sum, s) => sum + s.total, 0),
      count: daySales.length,
    }
  })

  const maxRev = Math.max(...last7.map((d) => d.revenue), 1)

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 bg-white border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-ink">Reports</h1>
        <p className="text-sm text-ink-secondary">Business overview</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<TrendingUp size={18} />}
            label="Today's Sales"
            value={`${todayRevenue.toLocaleString()} TZS`}
            sub={`${todayCount} transactions`}
            color="primary"
          />
          <KpiCard
            icon={<ShoppingBag size={18} />}
            label="Total Sales"
            value={sales.length.toString()}
            sub="All time"
            color="success"
          />
          <KpiCard
            icon={<Package size={18} />}
            label="Products"
            value={products.length.toString()}
            sub="In catalog"
            color="ink"
          />
          <KpiCard
            icon={<AlertTriangle size={18} />}
            label="Low Stock"
            value={lowStock.length.toString()}
            sub="Need attention"
            color={lowStock.length > 0 ? 'warning' : 'ink'}
          />
        </div>

        {/* 7-day chart */}
        <div className="bg-white rounded-card shadow-card p-5">
          <h2 className="font-semibold text-ink mb-4">Last 7 Days Revenue</h2>
          <div className="flex items-end gap-2 h-40">
            {last7.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-28">
                  <div
                    className="w-full max-w-[40px] rounded-t-md bg-primary/80 transition-all"
                    style={{ height: `${(d.revenue / maxRev) * 100}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
                  />
                </div>
                <span className="text-xs text-ink-muted">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock list */}
        {lowStock.length > 0 && (
          <div className="bg-white rounded-card shadow-card p-5">
            <h2 className="font-semibold text-ink mb-3">Low Stock Items</h2>
            <ul className="space-y-2">
              {lowStock.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{p.name}</span>
                  <span className="tabular-nums text-warning font-medium">{p.stock} left</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-success',
    warning: 'bg-amber-50 text-warning',
    ink: 'bg-surface-secondary text-ink-secondary',
  }
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="text-lg font-semibold text-ink tabular-nums mt-0.5">{value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
    </div>
  )
}
