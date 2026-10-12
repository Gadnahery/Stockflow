import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Cloud, CloudOff, RefreshCw, Trash2 } from 'lucide-react'
import { db, clearLocalBusinessData } from '../lib/db'
import Screen from '../components/ui/Screen'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { processOutbox, pullMissing, syncNow, getLastSyncAt, getLastPullAt } from '../lib/sync'
import { usePosStore } from '../store/posStore'
import { useUi } from '../store/uiStore'
import { useAuth } from '../contexts/AuthContext'

export default function SyncStatusPage() {
  const confirm = useConfirm()
  const toast = useUi((s) => s.toast)
  const isOnline = usePosStore((s) => s.isOnline)
  const refreshPendingSync = usePosStore((s) => s.refreshPendingSync)
  const { business } = useAuth()
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<string>('')

  const events = useLiveQuery(() => db.outbox.orderBy('createdAt').reverse().toArray(), []) || []
  const pending = events.length
  const dead = events.filter((e) => (e.retries || 0) >= 12)

  const clearLocal = async () => {
    const ok = await confirm({
      title: 'Clear local data?',
      message:
        'Removes products, sales, and customers stored on this device only. Cloud data for your business is kept. Sign in and Sync to load only your shop.',
      confirmLabel: 'Clear',
      tone: 'danger',
    })
    if (!ok) return
    await clearLocalBusinessData()
    try {
      localStorage.removeItem('sf_workspace_id')
      localStorage.removeItem('businessId')
      localStorage.removeItem('branchId')
      localStorage.removeItem('lastPullAt')
      localStorage.removeItem('lastSyncAt')
    } catch { /* ignore */ }
    await refreshPendingSync()
    toast('Local shop data cleared. Sign in again or Sync to load your business only.', 'info')
  }

  const resetRetries = async () => {
    const all = await db.outbox.toArray()
    await Promise.all(all.map((e) => db.outbox.update(e.id, { retries: 0, lastError: undefined })))
    await refreshPendingSync()
    toast('Retries cleared — tap Sync now', 'info')
  }

  const discard = async (id: string) => {
    const ok = await confirm({
      title: 'Discard change?',
      message: 'It will not reach the cloud.',
      confirmLabel: 'Discard',
      tone: 'danger',
    })
    if (!ok) return
    await db.outbox.delete(id)
    await refreshPendingSync()
  }

  const runSync = async () => {
    setBusy(true)
    try {
      const r = await syncNow()
      await refreshPendingSync()
      setLastResult(`Pushed ${r.synced}, failed ${r.failed}, pulled ${r.pulled}`)
      toast(r.failed ? 'Sync finished with errors' : 'Synced', r.failed ? 'error' : 'success')
    } catch (e) {
      toast((e as Error).message || 'Sync failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const lastSync = getLastSyncAt()
  const lastPull = getLastPullAt()

  return (
    <Screen
      title="Sync"
      subtitle={isOnline ? 'Online' : 'Offline — changes queue locally'}
      action={
        <div className="flex gap-2">
          {pending > 0 && (
            <button
              type="button"
              onClick={() => void resetRetries()}
              className="press h-9 px-3 rounded-full bg-black/[0.06] text-[12px] font-semibold"
            >
              Retry all
            </button>
          )}
          <button
            type="button"
            onClick={() => void clearLocal()}
            className="press h-9 px-3 rounded-full bg-red-50 text-danger text-[12px] font-semibold"
          >
            Clear local data
          </button>
          <button
            type="button"
            disabled={busy || !isOnline}
            onClick={() => void runSync()}
            className="press h-9 px-3.5 rounded-full bg-primary text-white text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 md:max-w-2xl pb-6">
        <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className={`h-11 w-11 rounded-full flex items-center justify-center ${isOnline ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'}`}>
              {isOnline ? <Cloud size={20} /> : <CloudOff size={20} />}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{isOnline ? 'Connected' : 'Working offline'}</p>
              <p className="text-[13px] text-ink-secondary truncate">
                {business?.name || 'No business'} · {pending} pending
                {dead.length > 0 ? ` · ${dead.length} stuck` : ''}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-[14px] bg-surface-secondary p-3">
              <p className="text-ink-muted">Last push</p>
              <p className="font-medium mt-0.5">{lastSync ? format(new Date(lastSync), 'dd MMM HH:mm') : '—'}</p>
            </div>
            <div className="rounded-[14px] bg-surface-secondary p-3">
              <p className="text-ink-muted">Last pull</p>
              <p className="font-medium mt-0.5">{lastPull ? format(new Date(lastPull), 'dd MMM HH:mm') : '—'}</p>
            </div>
          </div>
          {lastResult && <p className="text-[13px] text-ink-secondary">{lastResult}</p>}
        </div>

        {events.length === 0 ? (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-10 text-center">
            <p className="text-[16px] font-semibold">Queue is empty</p>
            <p className="text-[14px] text-ink-secondary mt-1">All local changes are synced (or none yet).</p>
          </div>
        ) : (
          <ul className="bg-white rounded-[22px] shadow-card divide-y divide-border overflow-hidden">
            {events.map((e) => (
              <li key={e.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px] capitalize">{e.type.replace(/_/g, ' ')}</span>
                  <span className="text-[12px] text-ink-muted">{format(new Date(e.createdAt), 'dd MMM HH:mm')}</span>
                  {(e.retries || 0) > 0 && (
                    <span className="text-[12px] font-bold text-danger">{e.retries} tries</span>
                  )}
                  <button type="button" onClick={() => void discard(e.id)} className="ml-auto press h-8 w-8 rounded-full bg-red-50 text-danger flex items-center justify-center" aria-label="Discard">
                    <Trash2 size={14} />
                  </button>
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
