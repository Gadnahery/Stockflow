import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Package, CloudOff, ChevronRight, Bell } from 'lucide-react'
import { db } from '../lib/db'
import Screen from '../components/ui/Screen'
import { usePosStore } from '../store/posStore'
import { fmt } from '../lib/util'
import { useI18n } from '../i18n/I18nContext'

export default function NotificationsPage() {
  const { t } = useI18n()
  const isOnline = usePosStore((s) => s.isOnline)
  const pendingSyncCount = usePosStore((s) => s.pendingSyncCount)
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), [])
  const outbox = useLiveQuery(() => db.outbox.toArray(), [])

  const low = useMemo(
    () => (products || []).filter((p) => p.stock <= (p.minStock ?? 0)).sort((a, b) => a.stock - b.stock),
    [products],
  )
  const out = useMemo(() => (products || []).filter((p) => p.stock <= 0), [products])
  const stuck = useMemo(() => (outbox || []).filter((e) => (e.retries || 0) >= 5), [outbox])

  const items: {
    key: string
    tone: 'warning' | 'danger' | 'info'
    icon: typeof AlertTriangle
    title: string
    body: string
    to: string
  }[] = []

  if (!isOnline) {
    items.push({
      key: 'offline',
      tone: 'info',
      icon: CloudOff,
      title: 'Working offline',
      body: 'Sales still save on this device. They will sync when you are online.',
      to: '/sync',
    })
  }
  if (pendingSyncCount > 0) {
    items.push({
      key: 'pending',
      tone: 'info',
      icon: CloudOff,
      title: `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} waiting to sync`,
      body: 'Open Sync to push sales and stock to the cloud.',
      to: '/sync',
    })
  }
  if (stuck.length > 0) {
    items.push({
      key: 'stuck',
      tone: 'danger',
      icon: AlertTriangle,
      title: `${stuck.length} stuck sync item${stuck.length === 1 ? '' : 's'}`,
      body: 'Retry or discard failed queue items on the Sync screen.',
      to: '/sync',
    })
  }
  if (out.length > 0) {
    items.push({
      key: 'out',
      tone: 'danger',
      icon: Package,
      title: `${out.length} product${out.length === 1 ? '' : 's'} out of stock`,
      body: out
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ') + (out.length > 3 ? '…' : ''),
      to: '/stock',
    })
  }
  if (low.length > 0) {
    items.push({
      key: 'low',
      tone: 'warning',
      icon: AlertTriangle,
      title: `${low.length} low-stock alert${low.length === 1 ? '' : 's'}`,
      body: low
        .slice(0, 4)
        .map((p) => `${p.name} (${fmt(p.stock)})`)
        .join(' · '),
      to: '/stock',
    })
  }

  return (
    <Screen title={t('notifications.title')} subtitle={t('notifications.sub')}>
      <div className="space-y-3 md:max-w-xl pb-8">
        {items.length === 0 ? (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-success/10 text-success flex items-center justify-center">
              <Bell size={24} />
            </div>
            <p className="mt-4 text-[16px] font-semibold">All clear</p>
            <p className="text-[14px] text-ink-secondary mt-1">No stock or sync alerts right now.</p>
          </div>
        ) : (
          items.map((n) => (
            <Link
              key={n.key}
              to={n.to}
              className={`flex items-start gap-3 rounded-[18px] bg-white shadow-card px-4 py-3.5 ${
                n.tone === 'danger' ? 'ring-1 ring-red-100' : n.tone === 'warning' ? 'ring-1 ring-amber-100' : ''
              }`}
            >
              <span
                className={`mt-0.5 h-10 w-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                  n.tone === 'danger'
                    ? 'bg-red-50 text-danger'
                    : n.tone === 'warning'
                      ? 'bg-amber-50 text-warning'
                      : 'bg-primary/10 text-primary'
                }`}
              >
                <n.icon size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">{n.title}</span>
                <span className="block text-[13px] text-ink-secondary mt-0.5">{n.body}</span>
              </span>
              <ChevronRight size={16} className="text-ink-muted mt-2 shrink-0" />
            </Link>
          ))
        )}
      </div>
    </Screen>
  )
}
