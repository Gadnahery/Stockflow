import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { db } from '../lib/db'
import { syncNow } from '../lib/sync'
import { usePosStore } from '../store/posStore'
import { useUi } from '../store/uiStore'
import Screen from '../components/ui/Screen'

export default function SyncStatusPage() {
  const events = useLiveQuery(() => db.outbox.orderBy('createdAt').toArray(), []) ?? []
  const { isOnline, refreshPendingSync } = usePosStore()
  const toast = useUi((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const failing = events.filter((e) => e.retries > 0)

  const run = async () => {
    setBusy(true)
    try {
      const r = await syncNow()
      await refreshPendingSync()
      toast(r.failed ? `${r.failed} still failing` : 'All synced', r.failed ? 'error' : 'success')
    } finally { setBusy(false) }
  }

  const discard = async (id: string) => {
    if (!confirm('Discard this change? It will NOT reach the cloud.')) return
    await db.outbox.delete(id)
    await refreshPendingSync()
  }

  return (
    <Screen title="Sync status" subtitle={isOnline ? 'Online' : 'Offline — changes are saved on this device'}>
      <div className="space-y-4 md:max-w-2xl">
        <div className="bg-white rounded-[22px] shadow-card p-5 flex items-center gap-4">
          <span className={`h-12 w-12 rounded-full flex items-center justify-center ${events.length === 0 ? 'bg-emerald-100 text-success' : failing.length ? 'bg-red-100 text-danger' : 'bg-amber-100 text-warning'}`}>
            {events.length === 0 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          </span>
          <div className="flex-1">
            <p className="text-[18px] font-bold">{events.length === 0 ? 'Everything is synced' : `${events.length} waiting`}</p>
            <p className="text-[14px] text-ink-secondary">{failing.length ? `${failing.length} failed and will retry` : 'Sent automatically every 30 seconds'}</p>
          </div>
          <button onClick={run} disabled={!isOnline || busy} className="press h-11 px-4 rounded-full bg-primary text-white font-semibold flex items-center gap-1.5 disabled:opacity-40">
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Sync
          </button>
        </div>

        {events.length > 0 && (
          <ul className="bg-white rounded-[22px] shadow-card divide-y divide-border overflow-hidden">
            {events.map((e) => (
              <li key={e.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px]">{e.type.replace('_', ' ')}</span>
                  <span className="text-[12px] text-ink-muted">{format(new Date(e.createdAt), 'dd MMM HH:mm')}</span>
                  {e.retries > 0 && <span className="text-[12px] font-bold text-danger">{e.retries} tries</span>}
                  <button onClick={() => discard(e.id)} className="ml-auto text-[13px] text-ink-muted">Discard</button>
                </div>
                {e.lastError && <p className="mt-1 text-[13px] text-danger break-words">{e.lastError}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  )
}
