import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { CashSession } from '../types'
import { format } from 'date-fns'
import { Play, Square } from 'lucide-react'

export default function ShiftsPage() {
  const sessions = useLiveQuery(
    () => db.cashSessions.orderBy('openedAt').reverse().toArray(),
    []
  ) || []

  const openSession = sessions.find((s) => s.status === 'open')
  const [float, setFloat] = useState('0')
  const [closing, setClosing] = useState('')
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [expected, setExpected] = useState(0)

  const currentUser = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('currentUser') || '{}')
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
    // Sum cash payments from sales during this shift
    const sales = await db.sales
      .where('status')
      .equals('completed')
      .filter((s) => s.shiftId === openSession.id || (!s.shiftId && s.createdAt >= openSession.openedAt))
      .toArray()

    let cashSales = 0
    for (const sale of sales) {
      for (const p of sale.payments) {
        if (p.method === 'cash') cashSales += p.amount
      }
    }
    const exp = openSession.openingFloat + cashSales
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

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 bg-white border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Cash Shifts</h1>
          <p className="text-sm text-ink-secondary">
            {openSession ? `Open since ${format(new Date(openSession.openedAt), 'HH:mm')}` : 'No open shift'}
          </p>
        </div>
        {openSession ? (
          <button
            onClick={prepareClose}
            className="flex items-center gap-2 h-10 px-4 rounded-button bg-danger text-white text-sm font-medium"
          >
            <Square size={14} />
            Close Shift
          </button>
        ) : (
          <button
            onClick={() => setShowOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover"
          >
            <Play size={14} />
            Open Shift
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-secondary">
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Opened</th>
                <th className="px-4 py-3 font-medium text-right">Float</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Variance</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium text-ink">{s.userName}</td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {format(new Date(s.openedAt), 'dd MMM HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.openingFloat.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                    {s.variance !== undefined ? (
                      <span className={s.variance === 0 ? 'text-success' : s.variance > 0 ? 'text-primary' : 'text-danger'}>
                        {s.variance > 0 ? '+' : ''}{s.variance.toLocaleString()}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.status === 'open' ? 'bg-emerald-50 text-success' : 'bg-surface-secondary text-ink-muted'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && (
            <p className="text-center text-ink-muted py-12">No shifts yet</p>
          )}
        </div>
      </div>

      {showOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-card shadow-xl p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Open Shift</h2>
            <label className="block text-sm text-ink-secondary mb-1.5">Opening float (cash in drawer)</label>
            <input
              type="number"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              className="w-full h-12 px-4 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none tabular-nums text-lg"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowOpen(false)} className="flex-1 h-11 rounded-button border border-border text-ink-secondary">
                Cancel
              </button>
              <button onClick={openShift} className="flex-1 h-11 rounded-button bg-primary text-white font-medium">
                Open
              </button>
            </div>
          </div>
        </div>
      )}

      {showClose && openSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-card shadow-xl p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Close Shift</h2>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Opening float</span>
                <span className="tabular-nums font-medium">{openSession.openingFloat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Expected cash</span>
                <span className="tabular-nums font-medium">{expected.toLocaleString()}</span>
              </div>
            </div>
            <label className="block text-sm text-ink-secondary mb-1.5">Actual cash counted</label>
            <input
              type="number"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              className="w-full h-12 px-4 rounded-button bg-surface-secondary border border-transparent focus:border-primary outline-none tabular-nums text-lg"
              autoFocus
            />
            {closing && (
              <p className={`mt-2 text-sm ${
                parseFloat(closing) - expected === 0 ? 'text-success' :
                parseFloat(closing) - expected > 0 ? 'text-primary' : 'text-danger'
              }`}>
                Variance: {(parseFloat(closing) - expected).toLocaleString()} TZS
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowClose(false)} className="flex-1 h-11 rounded-button border border-border text-ink-secondary">
                Cancel
              </button>
              <button onClick={closeShift} className="flex-1 h-11 rounded-button bg-danger text-white font-medium">
                Close Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
