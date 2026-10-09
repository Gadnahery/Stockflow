import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  format, startOfDay, endOfDay, subDays, differenceInCalendarDays, addHours, startOfHour,
} from 'date-fns'
import { TrendingUp, TrendingDown, AlertTriangle, Package } from 'lucide-react'
import { db } from '../lib/db'
import { usePermission } from '../hooks/usePermission'
import Screen from '../components/ui/Screen'
import ProductImage from '../components/ui/ProductImage'
import { fmt } from '../lib/util'

type Period = 'today' | '7d' | '30d'
const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
]
const METHOD_COLORS: Record<string, string> = { cash: '#34C759', mobile: '#007AFF', card: '#AF52DE', bank: '#FF9500', credit: '#8E8E93' }

export default function ReportsPage() {
  const { can } = usePermission()
  const [period, setPeriod] = useState<Period>('7d')
  const [selected, setSelected] = useState<number | null>(null)

  const salesQ = useLiveQuery(() => db.sales.where('status').equals('completed').toArray(), [])
  const productsQ = useLiveQuery(() => db.products.toArray(), [])
  const expensesQ = useLiveQuery(() => db.expenses.toArray(), [])
  const loading = salesQ === undefined || productsQ === undefined
  const sales = useMemo(() => salesQ ?? [], [salesQ])
  const products = useMemo(() => productsQ ?? [], [productsQ])
  const expenses = useMemo(() => expensesQ ?? [], [expensesQ])
  const showProfit = can('VIEW_PROFIT')

  const data = useMemo(() => {
    const days = PERIODS.find((p) => p.id === period)!.days
    const now = new Date()
    const start = startOfDay(subDays(now, days - 1))
    const prevStart = startOfDay(subDays(start, days))
    const inRange = (iso: string, a: Date, b: Date) => { const d = new Date(iso); return d >= a && d <= b }

    const cur = sales.filter((s) => inRange(s.createdAt, start, endOfDay(now)))
    const prev = sales.filter((s) => inRange(s.createdAt, prevStart, endOfDay(subDays(start, 1))))
    const revenue = cur.reduce((s, x) => s + x.total, 0)
    const prevRevenue = prev.reduce((s, x) => s + x.total, 0)
    const delta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null

    const prodMap = new Map(products.map((p) => [p.id, p]))
    let units = 0
    let profit = 0
    const byProduct = new Map<string, { name: string; imageUrl?: string; qty: number; revenue: number }>()
    const byCategory = new Map<string, number>()
    const byMethod = new Map<string, number>()
    cur.forEach((s) => {
      s.payments.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Math.min(p.amount, s.total)))
      s.items.forEach((i) => {
        const p = prodMap.get(i.productId)
        units += i.quantity
        profit += i.lineTotal - (p?.cost ?? 0) * i.quantity
        const row = byProduct.get(i.productId) ?? { name: i.name, imageUrl: p?.imageUrl ?? i.imageUrl, qty: 0, revenue: 0 }
        row.qty += i.quantity
        row.revenue += i.lineTotal
        byProduct.set(i.productId, row)
        const cat = p?.category || 'Uncategorised'
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + i.lineTotal)
      })
    })

    // chart buckets
    let buckets: { label: string; value: number; hint: string }[]
    if (period === 'today') {
      const s0 = startOfDay(now)
      buckets = Array.from({ length: 24 }, (_, h) => {
        const a = startOfHour(addHours(s0, h))
        const b = addHours(a, 1)
        const v = cur.filter((s) => { const d = new Date(s.createdAt); return d >= a && d < b }).reduce((t, x) => t + x.total, 0)
        return { label: h % 6 === 0 ? format(a, 'ha').toLowerCase() : '', value: v, hint: format(a, 'h a') }
      })
    } else {
      buckets = Array.from({ length: days }, (_, i) => {
        const day = subDays(now, days - 1 - i)
        const v = cur.filter((s) => differenceInCalendarDays(new Date(s.createdAt), day) === 0).reduce((t, x) => t + x.total, 0)
        const show = days === 7 || i % 5 === 0 || i === days - 1
        return { label: show ? (days === 7 ? format(day, 'EEE') : format(day, 'd MMM')) : '', value: v, hint: format(day, 'EEE d MMM') }
      })
    }

    const periodExpenses = expenses.filter((e) => inRange(e.createdAt, start, endOfDay(now))).reduce((t, e) => t + e.amount, 0)
    const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const methods = [...byMethod.entries()].sort((a, b) => b[1] - a[1])
    return {
      revenue, delta, orders: cur.length, units, profit, periodExpenses, buckets, topProducts, categories, methods,
      avg: cur.length ? revenue / cur.length : 0,
    }
  }, [sales, products, expenses, period])

  const lowStock = products.filter((p) => p.active && p.stock <= (p.minStock || 0))
  const stockValue = products.filter((p) => p.active).reduce((t, p) => t + p.stock * p.cost, 0)
  const maxBucket = Math.max(...data.buckets.map((b) => b.value), 1)
  const sel = selected !== null ? data.buckets[selected] : null
  const heroValue = sel ? sel.value : data.revenue
  const margin = data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0

  return (
    <Screen title="Reports" subtitle="How your shop is doing">
      {/* Period — iOS segmented control */}
      <div className="grid grid-cols-3 p-1 rounded-[14px] bg-black/[0.06]">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPeriod(p.id); setSelected(null) }}
            className={`h-9 rounded-[11px] text-[14px] font-semibold transition-all duration-200 ${period === p.id ? 'bg-white text-ink shadow-soft' : 'text-ink-secondary'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="skeleton h-72" />
          <div className="grid grid-cols-2 gap-3"><div className="skeleton h-24" /><div className="skeleton h-24" /></div>
        </div>
      ) : (
        <div className="mt-4 space-y-3.5 md:max-w-4xl">
          {/* Revenue + chart */}
          <Card>
            <p className="text-[14px] font-semibold text-ink-secondary">{sel ? sel.hint : 'Revenue'}</p>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span key={`${period}-${selected}`} className="bump text-[38px] leading-none font-bold tracking-tight tabular-nums">{fmt(heroValue)}</span>
              <span className="text-[15px] font-semibold text-ink-secondary">TZS</span>
              {!sel && data.delta !== null && (
                <span className={`ml-auto inline-flex items-center gap-1 text-[13px] font-bold px-2.5 py-1 rounded-full ${data.delta >= 0 ? 'bg-emerald-50 text-success' : 'bg-red-50 text-danger'}`}>
                  {data.delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(Math.round(data.delta))}%
                </span>
              )}
            </div>
            {!sel && data.delta === null && data.revenue > 0 && <p className="mt-1 text-[13px] text-ink-muted">No sales in the previous period to compare.</p>}

            <div className="mt-5 flex items-end gap-[3px] h-40" onMouseLeave={() => setSelected(null)}>
              {data.buckets.map((b, i) => {
                const h = b.value > 0 ? Math.max((b.value / maxBucket) * 100, 4) : 0
                const isSel = selected === i
                return (
                  <button
                    key={`${period}-${i}`}
                    onClick={() => setSelected(isSel ? null : i)}
                    aria-label={`${b.hint}: ${fmt(b.value)} TZS`}
                    className="flex-1 h-full flex items-end rounded-t-[6px] min-w-0"
                  >
                    <span
                      className="bar-grow block w-full rounded-t-[6px] transition-colors"
                      style={{
                        height: b.value > 0 ? `${h}%` : '3px',
                        background: b.value === 0 ? '#E6E6EB' : isSel ? '#0062CC' : selected !== null ? '#9CC7FF' : 'linear-gradient(#3395FF,#007AFF)',
                        animationDelay: `${Math.min(i * 14, 300)}ms`,
                      }}
                    />
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex gap-[3px]">
              {data.buckets.map((b, i) => (
                <span key={i} className="flex-1 min-w-0 text-center text-[10.5px] text-ink-muted whitespace-nowrap overflow-visible">{b.label}</span>
              ))}
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Orders" value={fmt(data.orders)} />
            <Kpi label="Average sale" value={fmt(data.avg)} unit="TZS" />
            <Kpi label="Items sold" value={fmt(data.units)} />
            {showProfit ? (
              <Kpi label="Gross profit" value={fmt(data.profit)} unit="TZS" tone={data.profit >= 0 ? 'good' : 'bad'} sub={data.revenue > 0 ? `${margin}% margin` : undefined} />
            ) : (
              <Kpi label="Products" value={fmt(products.filter((p) => p.active).length)} />
            )}
          </div>
          {showProfit && data.periodExpenses > 0 && (
            <Card>
              <div className="flex justify-between text-[15px]"><span className="text-ink-secondary">Expenses</span><span className="tabular-nums font-semibold">-{fmt(data.periodExpenses)}</span></div>
              <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-border">
                <span className="text-[15px] font-semibold">Net after expenses</span>
                <span className={`text-[20px] font-bold tabular-nums ${data.profit - data.periodExpenses >= 0 ? 'text-success' : 'text-danger'}`}>{fmt(data.profit - data.periodExpenses)}</span>
              </div>
            </Card>
          )}

          {/* Payment methods */}
          {data.methods.length > 0 && (
            <Card title="How customers paid">
              <div className="flex h-3 rounded-full overflow-hidden bg-black/[0.06]">
                {data.methods.map(([m, v]) => (
                  <span key={m} style={{ width: `${(v / Math.max(data.methods.reduce((t, x) => t + x[1], 0), 1)) * 100}%`, background: METHOD_COLORS[m] ?? '#8E8E93' }} className="transition-all duration-700" />
                ))}
              </div>
              <ul className="mt-3 space-y-2">
                {data.methods.map(([m, v]) => (
                  <li key={m} className="flex items-center gap-2.5 text-[15px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: METHOD_COLORS[m] ?? '#8E8E93' }} />
                    <span className="capitalize flex-1">{m}</span>
                    <span className="tabular-nums font-semibold">{fmt(v)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Top products */}
          <Card title="Best sellers">
            {data.topProducts.length === 0 ? (
              <Empty text="Sales will show up here after your first checkout." />
            ) : (
              <ul className="space-y-3">
                {data.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className="w-5 text-center text-[14px] font-bold text-ink-muted tabular-nums">{i + 1}</span>
                    <ProductImage name={p.name} src={p.imageUrl} className="h-11 w-11 rounded-[12px] shrink-0" textClass="text-base" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <p className="font-semibold text-[15px] truncate">{p.name}</p>
                        <p className="font-bold text-[15px] tabular-nums">{fmt(p.revenue)}</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(p.revenue / data.topProducts[0].revenue) * 100}%` }} />
                        </div>
                        <span className="text-[12px] text-ink-muted tabular-nums">{fmt(p.qty)} sold</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Categories */}
          {data.categories.length > 0 && (
            <Card title="By category">
              <ul className="space-y-2.5">
                {data.categories.map(([c, v]) => (
                  <li key={c}>
                    <div className="flex justify-between text-[15px]"><span className="font-medium">{c}</span><span className="tabular-nums font-semibold">{fmt(v)}</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-[#5E5CE6] transition-all duration-700" style={{ width: `${(v / data.categories[0][1]) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Inventory */}
          <Card title="Stock">
            {showProfit && (
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center"><Package size={20} /></div>
                <div>
                  <p className="text-[13px] text-ink-secondary">Inventory value at cost</p>
                  <p className="text-[18px] font-bold tabular-nums">{fmt(stockValue)} TZS</p>
                </div>
              </div>
            )}
            {lowStock.length === 0 ? (
              <p className="text-[15px] text-success font-semibold">Everything is well stocked.</p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-warning mb-2"><AlertTriangle size={15} /> {lowStock.length} running low</p>
                <ul className="divide-y divide-border">
                  {lowStock.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <ProductImage name={p.name} src={p.imageUrl} className="h-10 w-10 rounded-[11px] shrink-0" textClass="text-base" />
                      <span className="flex-1 text-[15px] font-medium truncate">{p.name}</span>
                      <span className={`text-[13px] font-bold tabular-nums px-2.5 py-1 rounded-full ${p.stock <= 0 ? 'bg-red-50 text-danger' : 'bg-amber-50 text-warning'}`}>{p.stock <= 0 ? 'Out' : `${fmt(p.stock)} left`}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      )}
    </Screen>
  )
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-[22px] shadow-card p-5">
      {title && <h2 className="text-[17px] font-bold tracking-tight mb-3.5">{title}</h2>}
      {children}
    </section>
  )
}

function Kpi({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-white rounded-[22px] shadow-card p-4">
      <p className="text-[13px] font-semibold text-ink-secondary">{label}</p>
      <p className={`mt-1 text-[24px] leading-tight font-bold tracking-tight tabular-nums ${tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : ''}`}>
        {value}{unit && <span className="ml-1 text-[12px] font-semibold text-ink-muted">{unit}</span>}
      </p>
      {sub && <p className="text-[12px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-[15px] text-ink-secondary py-2">{text}</p>
}
