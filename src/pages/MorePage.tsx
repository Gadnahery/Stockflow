import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Users, Truck, Wallet, ClipboardList, Download, ChevronRight, Lock, Package, Receipt,
  RefreshCw, Wifi, WifiOff, Upload, ShieldCheck, CloudCog, UserCircle, HelpCircle, LogOut, CreditCard, Building2, LayoutDashboard, Bell,
} from 'lucide-react'
import Screen from '../components/ui/Screen'
import { usePosStore } from '../store/posStore'
import { useUi } from '../store/uiStore'
import { syncNow as runSync } from '../lib/sync'
import { usePermission } from '../hooks/usePermission'
import { useAuth } from '../contexts/AuthContext'
import { promptInstall, isStandalone, canInstall } from '../lib/pwa'
import { useI18n } from '../i18n/I18nContext'
import type { MessageKey } from '../i18n/messages'

const sectionDefs: {
  title: string
  items: { icon: typeof Settings; labelKey: MessageKey; to: string; color: string }[]
}[] = [
  {
    title: 'Account',
    items: [
      { icon: UserCircle, labelKey: 'more.account', to: '/account', color: '#007AFF' },
      { icon: HelpCircle, labelKey: 'more.help', to: '/help', color: '#5856D6' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { icon: Receipt, labelKey: 'more.sales', to: '/sales', color: '#007AFF' },
      { icon: ClipboardList, labelKey: 'more.shifts', to: '/shifts', color: '#34C759' },
      { icon: Truck, labelKey: 'more.suppliers', to: '/suppliers', color: '#FF9500' },
      { icon: Bell, labelKey: 'more.notifications', to: '/notifications', color: '#FF9500' },
      { icon: LayoutDashboard, labelKey: 'more.home', to: '/home', color: '#007AFF' },
      { icon: Package, labelKey: 'more.stock', to: '/stock', color: '#AF52DE' },
      { icon: Wallet, labelKey: 'more.expenses', to: '/expenses', color: '#FF3B30' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: Users, labelKey: 'more.users', to: '/users', color: '#5856D6' },
      { icon: CreditCard, labelKey: 'more.billing', to: '/billing', color: '#5856D6' },
      { icon: Building2, labelKey: 'more.branches', to: '/branches', color: '#5AC8FA' },
      { icon: Settings, labelKey: 'more.settings', to: '/settings', color: '#8E8E93' },
      { icon: Upload, labelKey: 'more.import', to: '/import', color: '#34C759' },
      { icon: Download, labelKey: 'more.export', to: '/export', color: '#30B0C7' },
      { icon: CloudCog, labelKey: 'more.sync', to: '/sync', color: '#007AFF' },
      { icon: ShieldCheck, labelKey: 'more.audit', to: '/audit', color: '#FF2D55' },
    ],
  },
]

export default function MorePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user } = usePermission()
  const { lockWithPin, signOut, business } = useAuth()
  const { isOnline, pendingSyncCount, refreshPendingSync } = usePosStore()
  const toast = useUi((s) => s.toast)
  const [syncing, setSyncing] = useState(false)

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
    <Screen title={t('more.title')} subtitle="Operations and settings">
      <div className="space-y-6 md:max-w-2xl">
        <div className="bg-white rounded-[22px] shadow-card p-4">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#3395FF] to-[#0062CC] text-white flex items-center justify-center text-[22px] font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-bold truncate">{name}</p>
              <p className="text-[14px] text-ink-secondary capitalize">{user?.role || 'staff'}</p>
              {business?.name && (
                <p className="text-[13px] text-ink-muted truncate">{business.name}</p>
              )}
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
              type="button"
              onClick={syncNow}
              disabled={!isOnline || syncing}
              className="press h-10 px-4 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5 disabled:opacity-40"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> Sync now
            </button>
          </div>
        </div>

        {sectionDefs.map((section) => (
          <div key={section.title}>
            <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-4">{section.title}</h2>
            <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
              {section.items.map((item, i) => (
                <button
                  key={t(item.labelKey)}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="w-full flex items-center gap-3.5 pl-4 pr-3 text-left active:bg-black/[0.04] transition-colors"
                >
                  <span className="h-[34px] w-[34px] rounded-[10px] flex items-center justify-center text-white shrink-0" style={{ background: item.color }}>
                    <item.icon size={19} strokeWidth={2.2} />
                  </span>
                  <span className={`flex-1 min-w-0 py-3.5 ${i < section.items.length - 1 ? 'border-b border-border' : ''}`}>
                    <span className="flex items-center">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[16px] font-medium text-ink">{t(item.labelKey)}</span>
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

        <div className="space-y-3 pb-4">
          <button
            type="button"
            onClick={() => lockWithPin()}
            className="press w-full h-[52px] rounded-[18px] bg-white shadow-card text-ink text-[16px] font-semibold flex items-center justify-center gap-2"
          >
            <Lock size={18} /> Lock screen
          </button>
          
        {!isStandalone() && (
          <button
            type="button"
            onClick={async () => {
              const r = await promptInstall()
              if (r === 'unavailable') {
                toast('Use your browser menu: Install app / Add to Home Screen', 'info')
              }
            }}
            className="press w-full flex items-center gap-3 rounded-[18px] bg-white shadow-card px-4 py-3.5 text-left"
          >
            <span className="h-10 w-10 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center">
              <Download size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Install on this device</span>
              <span className="block text-[12px] text-ink-muted">Works offline on phone or PC</span>
            </span>
          </button>
        )}
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
            className="press w-full h-[52px] rounded-[18px] bg-white shadow-card text-danger text-[16px] font-semibold flex items-center justify-center gap-2"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </div>
    </Screen>
  )
}
