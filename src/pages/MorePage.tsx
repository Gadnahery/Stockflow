import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Users, Truck, Wallet, ClipboardList, Download, ChevronRight, LogOut, Package, Receipt,
  RefreshCw, Wifi, WifiOff,
} from 'lucide-react'
import Screen from '../components/ui/Screen'
import { usePosStore } from '../store/posStore'
import { useUi } from '../store/uiStore'
import { syncNow as runSync } from '../lib/sync'
import { usePermission } from '../hooks/usePermission'

const sections = [
  {
    title: 'Operations',
    items: [
      { icon: Receipt, label: 'Sales history', desc: 'View and reprint receipts', to: '/sales', color: '#007AFF' },
      { icon: ClipboardList, label: 'Cash shifts', desc: 'Open and close till sessions', to: '/shifts', color: '#34C759' },
      { icon: Truck, label: 'Suppliers & purchases', desc: 'Receive new stock', to: '/suppliers', color: '#FF9500' },
      { icon: Package, label: 'Stock adjustments', desc: 'Corrections and stock history', to: '/stock', color: '#AF52DE' },
      { icon: Wallet, label: 'Expenses', desc: 'Record business costs', to: '/expenses', color: '#FF3B30' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: Users, label: 'Users & permissions', desc: 'Staff accounts and roles', to: '/users', color: '#5856D6' },
      { icon: Settings, label: 'Settings', desc: 'Business, tax, receipts', to: '/settings', color: '#8E8E93' },
      { icon: Download, label: 'Export data', desc: 'Download sales and inventory', to: '/export', color: '#30B0C7' },
    ],
  },
]

export default function MorePage() {
  const navigate = useNavigate()
  const { user } = usePermission()
  const { isOnline, pendingSyncCount, refreshPendingSync } = usePosStore()
  const toast = useUi((s) => s.toast)
  const [syncing, setSyncing] = useState(false)

  const lock = () => {
    sessionStorage.removeItem('currentUser')
    navigate('/login')
  }

  const syncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const r = await runSync()
      await refreshPendingSync()
      if (r.failed > 0) toast(`${r.failed} item${r.failed > 1 ? 's' : ''} could not sync yet`, 'error')
      else toast(r.synced + r.pulled > 0 ? `Synced ${r.synced} sent, ${r.pulled} received` : 'Everything is up to date', 'success')
    } catch {
      toast('Sync failed. Check your connection.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const name: string = user?.name || 'User'

  return (
    <Screen title="More" subtitle="Operations and settings">
      <div className="space-y-6 md:max-w-2xl">
        {/* Account + sync */}
        <div className="bg-white rounded-[22px] shadow-card p-4">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#3395FF] to-[#0062CC] text-white flex items-center justify-center text-[22px] font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-bold truncate">{name}</p>
              <p className="text-[14px] text-ink-secondary capitalize">{user?.role || 'staff'}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-surface-secondary p-3">
            <span className={`h-9 w-9 rounded-full flex items-center justify-center ${isOnline ? 'bg-emerald-100 text-success' : 'bg-amber-100 text-warning'}`}>
              {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold">{isOnline ? 'Online' : 'Offline'}</p>
              <p className="text-[13px] text-ink-secondary">{pendingSyncCount > 0 ? `${pendingSyncCount} waiting to sync` : 'All changes synced'}</p>
            </div>
            <button
              onClick={syncNow}
              disabled={!isOnline || syncing}
              className="press h-10 px-4 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5 disabled:opacity-40"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> Sync now
            </button>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-4">{section.title}</h2>
            <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
              {section.items.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
                  className="w-full flex items-center gap-3.5 pl-4 pr-3 text-left active:bg-black/[0.04] transition-colors"
                >
                  <span className="h-[34px] w-[34px] rounded-[10px] flex items-center justify-center text-white shrink-0" style={{ background: item.color }}>
                    <item.icon size={19} strokeWidth={2.2} />
                  </span>
                  <span className={`flex-1 min-w-0 py-3.5 ${i < section.items.length - 1 ? 'border-b border-border' : ''}`}>
                    <span className="flex items-center">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[16px] font-medium text-ink">{item.label}</span>
                        <span className="block text-[13px] text-ink-muted">{item.desc}</span>
                      </span>
                      <ChevronRight size={18} className="text-ink-muted/70 shrink-0" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button onClick={lock} className="press w-full h-[52px] rounded-[18px] bg-white shadow-card text-danger text-[16px] font-semibold flex items-center justify-center gap-2">
          <LogOut size={18} /> Lock screen
        </button>
      </div>
    </Screen>
  )
}
