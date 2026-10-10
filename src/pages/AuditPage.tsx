import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { ShieldCheck } from 'lucide-react'
import { db } from '../lib/db'
import { usePermission } from '../hooks/usePermission'
import Screen from '../components/ui/Screen'

const ACTION_COLORS: Record<string, string> = {
  SALE_VOID: 'bg-red-50 text-danger', PRICE_CHANGE: 'bg-amber-50 text-warning', STOCK_ADJUST: 'bg-purple-50 text-purple-700',
  SALE_DISCOUNT: 'bg-blue-50 text-primary', CUSTOMER_PAYMENT: 'bg-emerald-50 text-success', DATA_IMPORT: 'bg-black/[0.06] text-ink-secondary',
}
const compact = (v: unknown) => (v == null ? '' : typeof v === 'object' ? Object.entries(v as object).map(([k, x]) => `${k}: ${x}`).join(', ') : String(v))

export default function AuditPage() {
  const { can } = usePermission()
  const [filter, setFilter] = useState('All')
  const logs = useLiveQuery(() => db.auditLogs.orderBy('createdAt').reverse().limit(300).toArray(), [])
  const actions = ['All', ...Array.from(new Set((logs ?? []).map((l) => l.action)))]
  const shown = (logs ?? []).filter((l) => filter === 'All' || l.action === filter)

  if (!can('MANAGE_USERS')) {
    return <Screen title="Audit log"><p className="py-16 text-center text-ink-secondary">Only owners and managers can view the audit trail.</p></Screen>
  }

  return (
    <Screen title="Audit log" subtitle="Who did what, when — voids, discounts, price and stock changes">
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
        {actions.map((a) => (
          <button key={a} onClick={() => setFilter(a)} className={`press shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold ${filter === a ? 'bg-ink text-white' : 'bg-black/[0.06] text-ink-secondary'}`}>{a === 'All' ? 'All' : a.replace('_', ' ')}</button>
        ))}
      </div>
      <div className="mt-4 md:max-w-3xl">
        {shown.length === 0 ? (
          <div className="text-center py-16"><ShieldCheck size={36} className="mx-auto text-ink-muted" /><p className="mt-3 text-ink-secondary">No activity recorded yet.</p></div>
        ) : (
          <ul className="bg-white rounded-[22px] shadow-card divide-y divide-border overflow-hidden">
            {shown.map((l) => (
              <li key={l.id} className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full ${ACTION_COLORS[l.action] ?? 'bg-black/[0.06]'}`}>{l.action.replace('_', ' ')}</span>
                  <span className="text-[14px] font-semibold">{l.userName || 'Unknown'}</span>
                  <span className="ml-auto text-[12px] text-ink-muted">{format(new Date(l.createdAt), 'dd MMM HH:mm')}</span>
                </div>
                {l.reason && <p className="mt-1 text-[14px] text-ink-secondary">{l.reason}</p>}
                {(l.before != null || l.after != null) && (
                  <p className="mt-1 text-[13px] text-ink-muted tabular-nums">{compact(l.before)}{l.before != null && l.after != null ? '  →  ' : ''}{compact(l.after)}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  )
}
