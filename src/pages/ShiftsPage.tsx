import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Square, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../lib/db'
import type { CashSession } from '../types'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { fmtMoney } from '../lib/util'

export default function ShiftsPage() {
  const sessions = useLiveQuery(() => db.cashSessions.orderBy('openedAt').reverse().toArray(), [])
  const loading = sessions === undefined
  const list = sessions || []
  const openSession = list.find((s) => s.status === 'open')
  const history = list.filter((s) => s.status === 'closed').slice(0, 40)

  const [float, setFloat] = useState('0')
  const [closing, setClosing] = useState('')
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [expected, setExpected] = useState(0)
  const [cashSales, setCashSales] = useState(0)

  const currentUser = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('currentUser') || '{}') as { id?: string; name?: string }
    } catch {
      return {}
    }
  })()

  const openShift = async () => {
    const amount = parseFloat(float) || 0
    const session: CashSession = {
      id: crypto.randomUUID(),
      userId: currentUser.id || 'unknown',
      userName: currentUser.name || 'User',
      openingFloat: amount,
      status: 'open',
      openedAt: new Date().toISOString(),
    }
    await db.cashSessions.add(session)
    setShowOpen(false)
    setFloat('0')
  }

  const prepareClose = async () => {
    if (!openSession) return
    const sales = await db.sales
      .where('status')
      .equals('completed')
      .filter((s) => s.shiftId === openSession.id || (!s.shiftId && s.createdAt >= openSession.openedAt))
      .toArray()

    let cash = 0
    for (const sale of sales) {
      for (const p of sale.payments) {
        if (p.method === 'cash') cash += p.amount
      }
    }
    const exp = openSession.openingFloat + cash
    setCashSales(cash)
    setExpected(exp)
    setClosing(String(exp))
    setShowClose(true)
  }

  const closeShift = async () => {
    if (!openSession) return
    const actual = parseFloat(closing) || 0
    const variance = actual - expected
    await db.cashSessions.update(openSession.id, {
      status: 'closed',
      closingCash: actual,
      expectedCash: expected,
      variance,
      closedAt: new Date().toISOString(),
    })
    setShowClose(false)
    setClosing('')
  }

  const variance = closing ? parseFloat(closing) - expected : 0

  return (
    <Screen
      title="Cash shifts"
      subtitle={openSession ? `Open since ${format(new Date(openSession.openedAt), 'HH:mm')}` : 'No open shift'}
      action={
        openSession ? (
          <button type="button" onClick={() => void prepareClose()} className="press h-9 px-3.5 rounded-full bg-danger text-white text-[14px] font-semibold flex items-center gap-1.5">
            <Square size={14} /> Close
          </button>
        ) : (
          <button type="button" onClick={() => setShowOpen(true)} className="press h-9 px-3.5 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5">
            <Play size={14} /> Open
          </button>
        )
      }
    >
      <div className="space-y-5 md:max-w-2xl pb-6">
        {/* Till dashboard */}
        {openSession ? (
          <div className="bg-white rounded-[22px] shadow-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 rounded-full bg-emerald-50 text-success flex items-center justify-center">
                <Clock size={20} />
              </span>
              <div>
                <p className="text-[16px] font-semibold">Till open</p>
                <p className="text-[13px] text-ink-secondary">{openSession.userName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[16px] bg-surface-secondary p-3">
                <p className="text-[12px] text-ink-muted font-medium">Opening float</p>
                <p className="text-[18px] font-bold tabular-nums mt-0.5">{fmtMoney(openSession.openingFloat)}</p>
              </div>
              <div className="rounded-[16px] bg-surface-secondary p-3">
                <p className="text-[12px] text-ink-muted font-medium">Opened</p>
                <p className="text-[18px] font-bold mt-0.5">{format(new Date(openSession.openedAt), 'HH:mm')}</p>
              </div>
            </div>
            <button type="button" onClick={() => void prepareClose()} className="press w-full h-12 rounded-[14px] bg-danger text-white font-semibold">
              Count cash & close shift
            </button>
          </div>
        ) : (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-10 text-center">
            <p className="text-[16px] font-semibold">No open shift</p>
            <p className="text-[14px] text-ink-secondary mt-1 mb-4">Open a till with an opening float before taking cash sales.</p>
            <button type="button" onClick={() => setShowOpen(true)} className="press h-11 px-5 rounded-[14px] bg-primary text-white font-semibold inline-flex items-center gap-2">
              <Play size={16} /> Open shift
            </button>
          </div>
        )}

        <div>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">History</h2>
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-[16px] bg-white shadow-card skeleton" />
              ))}
            </div>
          )}
          {!loading && history.length === 0 && (
            <p className="text-[14px] text-ink-muted px-1 py-4">Closed shifts will appear here.</p>
          )}
          {!loading && history.length > 0 && (
            <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
              {history.map((s, i) => (
                <div key={s.id} className={`px-4 py-3.5 ${i < history.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold truncate">{s.userName}</p>
                      <p className="text-[13px] text-ink-secondary">
                        {format(new Date(s.openedAt), 'dd MMM HH:mm')}
                        {s.closedAt ? ` → ${format(new Date(s.closedAt), 'HH:mm')}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] tabular-nums font-medium">{fmtMoney(s.closingCash ?? 0)}</p>
                      {typeof s.variance === 'number' && (
                        <p className={`text-[12px] font-semibold tabular-nums ${
                          s.variance === 0 ? 'text-success' : s.variance > 0 ? 'text-primary' : 'text-danger'
                        }`}>
                          {s.variance > 0 ? '+' : ''}{fmtMoney(s.variance)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={showOpen} onClose={() => setShowOpen(false)} title="Open shift" footer={
        <button type="button" onClick={() => void openShift()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold">Open till</button>
      }>
        <div>
          <label className="auth-label">Opening float (TZS)</label>
          <input className="field w-full text-lg tabular-nums" inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value)} autoFocus />
        </div>
      </Sheet>

      <Sheet open={showClose && !!openSession} onClose={() => setShowClose(false)} title="Close shift" footer={
        <button type="button" onClick={() => void closeShift()} className="press w-full h-12 rounded-[14px] bg-danger text-white font-semibold">Close shift</button>
      }>
        {openSession && (
          <div className="space-y-4">
            <div className="rounded-[16px] bg-surface-secondary p-4 space-y-2 text-[14px]">
              <div className="flex justify-between"><span className="text-ink-secondary">Opening float</span><span className="tabular-nums font-medium">{fmtMoney(openSession.openingFloat)}</span></div>
              <div className="flex justify-between"><span className="text-ink-secondary">Cash sales</span><span className="tabular-nums font-medium">{fmtMoney(cashSales)}</span></div>
              <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold">Expected</span><span className="tabular-nums font-bold">{fmtMoney(expected)}</span></div>
            </div>
            <div>
              <label className="auth-label">Cash counted</label>
              <input className="field w-full text-lg tabular-nums" inputMode="decimal" value={closing} onChange={(e) => setClosing(e.target.value)} autoFocus />
            </div>
            {closing !== '' && (
              <p className={`text-[14px] font-semibold tabular-nums ${variance === 0 ? 'text-success' : variance > 0 ? 'text-primary' : 'text-danger'}`}>
                Variance: {variance > 0 ? '+' : ''}{fmtMoney(variance)}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
