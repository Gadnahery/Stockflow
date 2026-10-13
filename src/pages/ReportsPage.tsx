import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  format, startOfDay, endOfDay, subDays, differenceInCalendarDays, addHours, startOfHour,
} from 'date-fns'
import {
  TrendingUp, TrendingDown, AlertTriangle, Package, Receipt, Wallet,
  Users, ShoppingCart, ChevronRight, ArrowRightLeft,
} from 'lucide-react'
import { db } from '../lib/db'
import { usePermission } from '../hooks/usePermission'
import Screen from '../components/ui/Screen'
import ProductImage from '../components/ui/ProductImage'
import { useI18n } from '../i18n/I18nContext'
import { fmt, fmtMoney } from '../lib/util'

type Period = 'today' | '7d' | '30d'
const PERIODS: { id: Period; labelKey: 'reports.today' | 'reports.7d' | 'reports.30d'; days: number }[] = [
  { id: 'today', labelKey: 'reports.today', days: 1 },
  { id: '7d', labelKey: 'reports.7d', days: 7 },
  { id: '30d', labelKey: 'reports.30d', days: 30 },
]
const METHOD_COLORS: Record<string, string> = {
  cash: '#34C759', mobile: '#007AFF', card: '#AF52DE', bank: '#FF9500', credit: '#8E8E93',
}

export default function ReportsPage() {
  const { t } = useI18n()
  const { can } = usePermission()
  const [period, setPeriod] = useState<Period>('7d')
  const [selected, setSelected] = useState<number | null>(null)

  const salesQ = useLiveQuery(() => db.sales.toArray(), [])
  const productsQ = useLiveQuery(() => db.products.toArray(), [])
  const expensesQ = useLiveQuery(() => db.expenses.toArray(), [])
  const customersQ = useLiveQuery(() => db.customers.toArray(), [])
  const sessionsQ = useLiveQuery(() => db.cashSessions.orderBy('openedAt').reverse().limit(20).toArray(), [])

  const loading = salesQ === undefined || productsQ === undefined
  const sales = useMemo(() => salesQ ?? [], [salesQ])
  const products = useMemo(() => productsQ ?? [], [productsQ])
  const expenses = useMemo(() => expensesQ ?? [], [expensesQ])
  const customers = useMemo(() => customersQ ?? [], [customersQ])
  const sessions = useMemo(() => sessionsQ ?? [], [sessionsQ])
  const showCost = can('VIEW_PROFIT')

  const data = useMemo(() => {
    const days = PERIODS.find((p) => p.id === period)!.days
    const now = new Date()
    const start = startOfDay(subDays(now, days - 1))
    const end = endOfDay(now)
    const prevStart = startOfDay(subDays(start, days))
    const prevEnd = endOfDay(subDays(start, 1))
    const inRange = (iso: string, a: Date, b: Date) => {
      const d = new Date(iso)
      return d >= a && d <= b
    }

    const completed = sales.filter((s) => s.status === 'completed')
    const voided = sales.filter((s) => s.status === 'voided')
    const cur = completed.filter((s) => inRange(s.createdAt, start, end))
    const prev = completed.filter((s) => inRange(s.createdAt, prevStart, prevEnd))
    const curVoided = voided.filter((s) => inRange(s.createdAt, start, end))

    const revenue = cur.reduce((s, x) => s + x.total, 0)
    const prevRevenue = prev.reduce((s, x) => s + x.total, 0)
    const delta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null
    const voidedTotal = curVoided.reduce((s, x) => s + x.total, 0)

    const prodMap = new Map(products.map((p) => [p.id, p]))
    let units = 0
    let cogs = 0
    let discountTotal = 0
    const byProduct = new Map<string, { name: string; imageUrl?: string; qty: number; revenue: number; cost: number }>()
    const byCategory = new Map<string, number>()
    const byMethod = new Map<string, number>()

    cur.forEach((s) => {
      discountTotal += s.discount || 0
      s.payments.forEach((p) => {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Math.min(p.amount, s.total))
      })
      s.items.forEach((i) => {
        const p = prodMap.get(i.productId)
        const unitCost = p?.cost ?? 0
        units += i.quantity
        cogs += unitCost * i.quantity
        const row = byProduct.get(i.productId) ?? {
          name: i.name,
          imageUrl: p?.imageUrl ?? i.imageUrl,
          qty: 0,
          revenue: 0,
          cost: 0,
        }
        row.qty += i.quantity
        row.revenue += i.lineTotal
        row.cost += unitCost * i.quantity
        byProduct.set(i.productId, row)
        const cat = p?.category || 'Uncategorised'
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + i.lineTotal)
      })
    })

    const periodExpenses = expenses
      .filter((e) => inRange(e.createdAt, start, end))
      .reduce((t, e) => t + e.amount, 0)
    const prevExpenses = expenses
      .filter((e) => inRange(e.createdAt, prevStart, prevEnd))
      .reduce((t, e) => t + e.amount, 0)

    const expensesByCat = new Map<string, number>()
    expenses
      .filter((e) => inRange(e.createdAt, start, end))
      .forEach((e) => {
        expensesByCat.set(e.category, (expensesByCat.get(e.category) ?? 0) + e.amount)
      })

    const grossProfit = revenue - cogs
    const netProfit = grossProfit - periodExpenses
    const prevCogs = (() => {
      let c = 0
      prev.forEach((s) => {
        s.items.forEach((i) => {
          c += (prodMap.get(i.productId)?.cost ?? 0) * i.quantity
        })
      })
      return c
    })()
    const prevGross = prevRevenue - prevCogs
    const prevNet = prevGross - prevExpenses
    const netDelta = prevNet !== 0 ? ((netProfit - prevNet) / Math.abs(prevNet)) * 100 : null

    // Chart buckets
    let buckets: { label: string; value: number; hint: string }[]
    if (period === 'today') {
      const s0 = startOfDay(now)
      buckets = Array.from({ length: 24 }, (_, h) => {
        const a = startOfHour(addHours(s0, h))
        const b = addHours(a, 1)
        const v = cur
          .filter((s) => {
            const d = new Date(s.createdAt)
            return d >= a && d < b
          })
          .reduce((t, x) => t + x.total, 0)
        return { label: h % 6 === 0 ? format(a, 'ha').toLowerCase() : '', value: v, hint: format(a, 'h a') }
      })
    } else {
      buckets = Array.from({ length: days }, (_, i) => {
        const day = subDays(now, days - 1 - i)
        const v = cur
          .filter((s) => differenceInCalendarDays(new Date(s.createdAt), day) === 0)
          .reduce((t, x) => t + x.total, 0)
        const show = days === 7 || i % 5 === 0 || i === days - 1
        return {
          label: show ? (days === 7 ? format(day, 'EEE') : format(day, 'd MMM')) : '',
          value: v,
          hint: format(day, 'EEE d MMM'),
        }
      })
    }

    const cashTaken = byMethod.get('cash') ?? 0
    const creditSales = byMethod.get('credit') ?? 0
    const collected = revenue - creditSales

    const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6)
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    const methods = [...byMethod.entries()].sort((a, b) => b[1] - a[1])
    const expCats = [...expensesByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

    return {
      revenue,
      delta,
      orders: cur.length,
      units,
      cogs,
      grossProfit,
      periodExpenses,
      netProfit,
      prevNet,
      netDelta,
      discountTotal,
      voidedTotal,
      voidedCount: curVoided.length,
      cashTaken,
      creditSales,
      collected,
      buckets,
      topProducts,
      categories,
      methods,
      expCats,
      avg: cur.length ? revenue / cur.length : 0,
      margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    }
  }, [sales, products, expenses, period])

  const lowStock = products.filter((p) => p.active && p.stock <= (p.minStock || 0))
  const stockValue = products.filter((p) => p.active).reduce((t, p) => t + p.stock * p.cost, 0)
  const stockRetail = products.filter((p) => p.active).reduce((t, p) => t + p.stock * p.price, 0)
  const creditOutstanding = customers.reduce((t, c) => t + Math.max(0, c.balance), 0)
  const maxBucket = Math.max(...data.buckets.map((b) => b.value), 1)
  const sel = selected !== null ? data.buckets[selected] : null
  const heroValue = sel ? sel.value : data.revenue

  return (
    <Screen title={t('reports.title')} subtitle={t('reports.sub')}>
      <div className="space-y-5 md:max-w-3xl pb-8">
        {/* Period */}
        <div className="grid grid-cols-3 p-1 rounded-[14px] bg-black/[0.06]">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPeriod(p.id)
                setSelected(null)
              }}
              className={`h-9 rounded-[11px] text-[14px] font-semibold transition-all duration-200 ${
                period === p.id ? 'bg-white text-ink shadow-soft' : 'text-ink-secondary'
              }`}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-[22px] bg-white shadow-card skeleton" />
            ))}
          </div>
        ) : (
          <>
            {/* Revenue hero + chart */}
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink-secondary">
                    {sel ? sel.hint : 'Sales revenue'}
                  </p>
                  <p className="text-[32px] font-bold tracking-tight tabular-nums mt-0.5">
                    {fmt(heroValue)}
                    <span className="text-[14px] font-semibold text-ink-muted ml-1">TZS</span>
                  </p>
                  {data.delta != null && !sel && (
                    <p
                      className={`text-[13px] font-semibold mt-1 flex items-center gap-1 ${
                        data.delta >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {data.delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {data.delta >= 0 ? '+' : ''}
                      {data.delta.toFixed(1)}% vs prior period
                    </p>
                  )}
                </div>
                <Link
                  to="/sales"
                  className="text-[13px] font-semibold text-primary flex items-center gap-0.5 shrink-0"
                >
                  All sales <ChevronRight size={14} />
                </Link>
              </div>
              <div className="mt-4 flex items-end gap-1 h-24">
                {data.buckets.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(selected === i ? null : i)}
                    className="flex-1 flex flex-col items-center justify-end h-full gap-1"
                    title={`${b.hint}: ${fmt(b.value)}`}
                  >
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        selected === i ? 'bg-primary' : 'bg-primary/30 hover:bg-primary/50'
                      }`}
                      style={{ height: `${Math.max(4, (b.value / maxBucket) * 100)}%` }}
                    />
                    {b.label && (
                      <span className="text-[9px] text-ink-muted leading-none">{b.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </Card>

            {/* ─── Profit & Loss (connected ERP view) ─── */}
            <Card title={t('reports.pnl')}>
              <p className="text-[13px] text-ink-secondary mb-3 -mt-1">
                How sales, product cost, and expenses form your net result
              </p>
              <div className="space-y-0 text-[15px]">
                <PlRow label="Sales revenue" value={data.revenue} link="/sales" />
                {showCost && (
                  <PlRow label="− Cost of goods (COGS)" value={data.cogs} muted />
                )}
                {showCost && (
                  <PlRow
                    label="Gross profit"
                    value={data.grossProfit}
                    bold
                    tone={data.grossProfit >= 0 ? 'good' : 'bad'}
                    sub={data.revenue > 0 ? `${data.margin.toFixed(0)}% margin` : undefined}
                  />
                )}
                <PlRow label="− Operating expenses" value={data.periodExpenses} link="/expenses" muted />
                <div className="border-t border-border my-2" />
                <PlRow
                  label={showCost ? 'Net profit' : 'Revenue − expenses'}
                  value={showCost ? data.netProfit : data.revenue - data.periodExpenses}
                  bold
                  large
                  tone={
                    (showCost ? data.netProfit : data.revenue - data.periodExpenses) >= 0
                      ? 'good'
                      : 'bad'
                  }
                  sub={
                    showCost && data.revenue > 0
                      ? `${data.netMargin.toFixed(0)}% of revenue`
                      : undefined
                  }
                />
              </div>
              {showCost && data.netDelta != null && (
                <p
                  className={`mt-3 text-[13px] font-semibold flex items-center gap-1 ${
                    data.netDelta >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {data.netDelta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  Net {data.netDelta >= 0 ? 'up' : 'down'} {Math.abs(data.netDelta).toFixed(1)}% vs
                  prior period
                </p>
              )}
              {!showCost && (
                <p className="mt-3 text-[12px] text-ink-muted">
                  Gross margin and full net profit need the View profit permission (ask an owner).
                </p>
              )}
            </Card>

            {/* Snapshot KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Orders" value={String(data.orders)} sub={`${fmt(data.units)} units sold`} />
              <Kpi label="Avg ticket" value={fmt(data.avg)} unit="TZS" />
              <Kpi
                label="Collected (cash-like)"
                value={fmt(data.collected)}
                unit="TZS"
                sub="Excludes store credit"
              />
              <Kpi
                label="Sold on credit"
                value={fmt(data.creditSales)}
                unit="TZS"
                tone={data.creditSales > 0 ? 'bad' : undefined}
              />
            </div>

            {/* Money movement */}
            <Card title={t('reports.payments')}>
              <div className="space-y-3">
                {data.methods.length === 0 ? (
                  <Empty text={t('reports.noPayments')} />
                ) : (
                  data.methods.map(([method, amount]) => {
                    const pct = data.revenue > 0 ? (amount / data.revenue) * 100 : 0
                    return (
                      <div key={method}>
                        <div className="flex justify-between text-[14px] mb-1">
                          <span className="font-medium capitalize flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: METHOD_COLORS[method] || '#8E8E93' }}
                            />
                            {method}
                          </span>
                          <span className="tabular-nums font-semibold">
                            {fmt(amount)} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: METHOD_COLORS[method] || '#8E8E93',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {(data.discountTotal > 0 || data.voidedCount > 0) && (
                <div className="mt-4 pt-3 border-t border-border text-[13px] text-ink-secondary space-y-1">
                  {data.discountTotal > 0 && (
                    <p>Discounts given: <strong className="text-ink">{fmtMoney(data.discountTotal)}</strong></p>
                  )}
                  {data.voidedCount > 0 && (
                    <p>
                      Voided: <strong className="text-danger">{data.voidedCount}</strong> sales (
                      {fmtMoney(data.voidedTotal)})
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Expenses breakdown */}
            <Card
              title="Expenses"
              action={
                <Link to="/expenses" className="text-[13px] font-semibold text-primary flex items-center gap-0.5">
                  Manage <ChevronRight size={14} />
                </Link>
              }
            >
              {data.periodExpenses === 0 ? (
                <Empty text="No expenses recorded in this period." />
              ) : (
                <div className="space-y-2">
                  <p className="text-[22px] font-bold tabular-nums mb-2">{fmtMoney(data.periodExpenses)}</p>
                  {data.expCats.map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-[14px]">
                      <span className="text-ink-secondary">{cat}</span>
                      <span className="tabular-nums font-medium">{fmtMoney(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Top products */}
            <Card title={t('reports.best')}>
              {data.topProducts.length === 0 ? (
                <Empty text={t('reports.noSales')} />
              ) : (
                <ul className="divide-y divide-border">
                  {data.topProducts.map((p, i) => (
                    <li key={p.name + i} className="flex items-center gap-3 py-2.5">
                      <ProductImage
                        name={p.name}
                        src={p.imageUrl}
                        className="h-10 w-10 rounded-[11px] shrink-0"
                        textClass="text-base"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium truncate">{p.name}</p>
                        <p className="text-[12px] text-ink-muted tabular-nums">
                          {fmt(p.qty)} sold
                          {showCost && p.revenue > 0 && (
                            <> · {(((p.revenue - p.cost) / p.revenue) * 100).toFixed(0)}% margin</>
                          )}
                        </p>
                      </div>
                      <span className="text-[14px] font-semibold tabular-nums">{fmt(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Categories */}
            {data.categories.length > 0 && (
              <Card title={t('reports.category')}>
                <div className="space-y-2">
                  {data.categories.map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-[14px]">
                      <span className="text-ink-secondary">{cat}</span>
                      <span className="tabular-nums font-medium">{fmtMoney(amt)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Balance sheet style snapshot */}
            <Card title={t('reports.stock')}>
              <div className="space-y-3 text-[14px]">
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary flex items-center gap-2">
                    <Package size={15} /> Stock at cost
                  </span>
                  <span className="font-semibold tabular-nums">{fmtMoney(stockValue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary flex items-center gap-2">
                    <Package size={15} /> Stock at retail
                  </span>
                  <span className="font-semibold tabular-nums">{fmtMoney(stockRetail)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary flex items-center gap-2">
                    <Users size={15} /> Customer credit owed to you
                  </span>
                  <span className={`font-semibold tabular-nums ${creditOutstanding > 0 ? 'text-warning' : ''}`}>
                    {fmtMoney(creditOutstanding)}
                  </span>
                </div>
                {lowStock.length > 0 && (
                  <Link
                    to="/stock"
                    className="flex items-center gap-2 pt-2 border-t border-border text-warning font-semibold"
                  >
                    <AlertTriangle size={15} />
                    {lowStock.length} product{lowStock.length === 1 ? '' : 's'} low / out
                    <ChevronRight size={14} className="ml-auto" />
                  </Link>
                )}
              </div>
            </Card>

            {/* Recent till variance */}
            {sessions.some((s) => s.status === 'closed' && typeof s.variance === 'number' && s.variance !== 0) && (
              <Card title="Cash variance (recent shifts)">
                <ul className="divide-y divide-border">
                  {sessions
                    .filter((s) => s.status === 'closed' && typeof s.variance === 'number')
                    .slice(0, 5)
                    .map((s) => (
                      <li key={s.id} className="flex justify-between py-2.5 text-[14px]">
                        <span className="text-ink-secondary">
                          {s.userName} · {format(new Date(s.openedAt), 'dd MMM')}
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            (s.variance || 0) === 0
                              ? 'text-success'
                              : (s.variance || 0) > 0
                                ? 'text-primary'
                                : 'text-danger'
                          }`}
                        >
                          {(s.variance || 0) > 0 ? '+' : ''}
                          {fmtMoney(s.variance || 0)}
                        </span>
                      </li>
                    ))}
                </ul>
                <Link to="/shifts" className="text-[13px] font-semibold text-primary mt-2 inline-flex items-center gap-0.5">
                  Cash shifts <ChevronRight size={14} />
                </Link>
              </Card>
            )}

            {/* Quick links — ERP navigation */}
            <Card title={t('reports.explore')}>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { to: '/sales', icon: Receipt, label: 'Sales history' },
                  { to: '/expenses', icon: Wallet, label: 'Expenses' },
                  { to: '/customers', icon: Users, label: 'Credit accounts' },
                  { to: '/stock', icon: Package, label: 'Inventory' },
                  { to: '/', icon: ShoppingCart, label: 'New sale' },
                  { to: '/shifts', icon: ArrowRightLeft, label: 'Cash shifts' },
                ].map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="flex items-center gap-2.5 rounded-[14px] bg-surface-secondary px-3 py-3 text-[14px] font-semibold"
                  >
                    <l.icon size={16} className="text-primary shrink-0" />
                    {l.label}
                  </Link>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </Screen>
  )
}

function PlRow({
  label,
  value,
  muted,
  bold,
  large,
  tone,
  sub,
  link,
}: {
  label: string
  value: number
  muted?: boolean
  bold?: boolean
  large?: boolean
  tone?: 'good' | 'bad'
  sub?: string
  link?: string
}) {
  const color =
    tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : muted ? 'text-ink-secondary' : 'text-ink'
  const inner = (
    <div className={`flex justify-between items-baseline gap-3 py-1.5 ${bold ? 'font-semibold' : ''}`}>
      <span className={`${muted ? 'text-ink-secondary' : ''} ${large ? 'text-[16px]' : ''}`}>
        {label}
        {sub && <span className="block text-[12px] font-normal text-ink-muted">{sub}</span>}
      </span>
      <span className={`tabular-nums ${color} ${large ? 'text-[20px] font-bold' : ''}`}>
        {fmtMoney(value)}
      </span>
    </div>
  )
  if (link) {
    return (
      <Link to={link} className="block hover:bg-black/[0.02] -mx-1 px-1 rounded-lg">
        {inner}
      </Link>
    )
  }
  return inner
}

function Card({
  title,
  children,
  action,
}: {
  title?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="bg-white rounded-[22px] shadow-card p-5">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3.5">
          {title && <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function Kpi({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="bg-white rounded-[22px] shadow-card p-4">
      <p className="text-[13px] font-semibold text-ink-secondary">{label}</p>
      <p
        className={`mt-1 text-[22px] leading-tight font-bold tracking-tight tabular-nums ${
          tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : ''
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-[12px] font-semibold text-ink-muted">{unit}</span>}
      </p>
      {sub && <p className="text-[12px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-[15px] text-ink-secondary py-2">{text}</p>
}
