import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import Screen from '../components/ui/Screen'
import { useUi } from '../store/uiStore'
import { fmt } from '../lib/util'

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const toast = useUi((s) => s.toast)
  const [form, setForm] = useState({
    businessName: '',
    businessPhone: '',
    businessAddress: '',
    currency: 'TZS',
    taxRate: '18',
    taxInclusive: true,
    receiptFooter: '',
    offlineWindowHours: '72',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setForm({
      businessName: settings.businessName || '',
      businessPhone: settings.businessPhone || '',
      businessAddress: settings.businessAddress || '',
      currency: settings.currency || 'TZS',
      taxRate: String(settings.taxRate ?? 18),
      taxInclusive: settings.taxInclusive !== false,
      receiptFooter: settings.receiptFooter || '',
      offlineWindowHours: String(settings.offlineWindowHours ?? 72),
    })
  }, [settings])

  const save = async () => {
    setSaving(true)
    try {
      await db.settings.put({
        id: 'main',
        businessName: form.businessName.trim() || 'My Store',
        businessPhone: form.businessPhone.trim() || undefined,
        businessAddress: form.businessAddress.trim() || undefined,
        currency: form.currency.trim() || 'TZS',
        taxRate: parseFloat(form.taxRate) || 0,
        taxInclusive: form.taxInclusive,
        receiptFooter: form.receiptFooter.trim() || undefined,
        offlineWindowHours: parseInt(form.offlineWindowHours, 10) || 72,
        deviceId: settings?.deviceId || crypto.randomUUID(),
        branchId: settings?.branchId,
        logoUrl: settings?.logoUrl,
      })
      toast('Settings saved', 'success')
    } catch {
      toast('Could not save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <Screen title="Settings" subtitle="Business, tax, and receipts">
      <div className="space-y-6 md:max-w-lg pb-8">
        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Business</h2>
          <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
            <div>
              <label className="auth-label">Business name</label>
              <input className="field w-full" value={form.businessName} onChange={(e) => set({ businessName: e.target.value })} />
            </div>
            <div>
              <label className="auth-label">Phone</label>
              <input className="field w-full" inputMode="tel" value={form.businessPhone} onChange={(e) => set({ businessPhone: e.target.value })} />
            </div>
            <div>
              <label className="auth-label">Address</label>
              <input className="field w-full" value={form.businessAddress} onChange={(e) => set({ businessAddress: e.target.value })} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Tax</h2>
          <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
            <div>
              <label className="auth-label">Tax rate (%)</label>
              <input className="field w-full" inputMode="decimal" value={form.taxRate} onChange={(e) => set({ taxRate: e.target.value })} />
            </div>
            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-[15px] font-medium">Prices include tax</span>
              <input type="checkbox" checked={form.taxInclusive} onChange={(e) => set({ taxInclusive: e.target.checked })} className="h-5 w-5 rounded accent-primary" />
            </label>
            <div>
              <label className="auth-label">Currency</label>
              <input className="field w-full" value={form.currency} onChange={(e) => set({ currency: e.target.value })} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Receipt</h2>
          <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
            <div>
              <label className="auth-label">Footer message</label>
              <input className="field w-full" value={form.receiptFooter} onChange={(e) => set({ receiptFooter: e.target.value })} placeholder="Thank you for shopping!" />
            </div>
            <div className="rounded-[16px] bg-surface-secondary p-4 text-[13px] text-ink-secondary">
              <p className="font-semibold text-ink mb-1">{form.businessName || 'Your store'}</p>
              <p>Sample total · {fmt(12500)} {form.currency}</p>
              <p className="mt-2 italic">{form.receiptFooter || '—'}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Data</h2>
          <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
            <div>
              <label className="auth-label">Offline window (hours)</label>
              <input className="field w-full" inputMode="numeric" value={form.offlineWindowHours} onChange={(e) => set({ offlineWindowHours: e.target.value })} />
              <p className="text-[12px] text-ink-muted mt-1">How long PIN unlock may work without the server.</p>
            </div>
            {settings?.deviceId && (
              <p className="text-[12px] text-ink-muted break-all">Device ID: {settings.deviceId}</p>
            )}
          </div>
        </section>

        <button type="button" disabled={saving} onClick={() => void save()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold disabled:opacity-60">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </Screen>
  )
}
