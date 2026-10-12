import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, ChevronRight, Check } from 'lucide-react'
import { db } from '../lib/db'
import Screen from '../components/ui/Screen'
import { useUi } from '../store/uiStore'
import { useAuth } from '../contexts/AuthContext'
import { supabase, getBusinessId } from '../lib/supabase'
import { fmt } from '../lib/util'

type BranchRow = { id: string; name: string; code: string | null }

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const { member, business } = useAuth()
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
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [activeBranchId, setActiveBranchId] = useState(
    () => localStorage.getItem('branchId') || settings?.branchId || '',
  )
  const [loadingBranches, setLoadingBranches] = useState(true)

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
    if (settings.branchId && !localStorage.getItem('branchId')) {
      setActiveBranchId(settings.branchId)
    }
  }, [settings])

  useEffect(() => {
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase) {
      setLoadingBranches(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoadingBranches(true)
      const { data } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('business_id', bizId)
        .order('name')
      if (cancelled) return
      const list = (data as BranchRow[]) || []
      setBranches(list)
      const stored = localStorage.getItem('branchId')
      if (stored && list.some((b) => b.id === stored)) {
        setActiveBranchId(stored)
      } else if (list[0]) {
        // Default to first branch when none chosen
        if (!stored) {
          localStorage.setItem('branchId', list[0].id)
          setActiveBranchId(list[0].id)
        }
      }
      setLoadingBranches(false)
    })()
    return () => {
      cancelled = true
    }
  }, [member?.business_id])

  const selectBranch = async (id: string) => {
    setActiveBranchId(id)
    localStorage.setItem('branchId', id)
    try {
      await db.settings.update('main', { branchId: id })
    } catch {
      /* settings row may not exist yet */
    }
    const name = branches.find((b) => b.id === id)?.name
    toast(name ? `Branch: ${name}` : 'Branch updated', 'success')
  }

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
        branchId: activeBranchId || settings?.branchId,
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
  const activeBranch = branches.find((b) => b.id === activeBranchId)

  return (
    <Screen title="Settings" subtitle={business?.name || 'Business, tax, and receipts'}>
      <div className="space-y-6 md:max-w-lg pb-8">
        {/* Branch selection */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[13px] font-semibold text-ink-secondary">Branch</h2>
            <Link to="/branches" className="text-[13px] font-semibold text-primary flex items-center gap-0.5">
              Manage <ChevronRight size={14} />
            </Link>
          </div>
          <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
            {loadingBranches && (
              <div className="px-4 py-5 text-[14px] text-ink-muted">Loading branches…</div>
            )}
            {!loadingBranches && branches.length === 0 && (
              <div className="px-4 py-5">
                <p className="text-[14px] text-ink-secondary mb-3">
                  No branches yet. Create one so sales are tagged to a location.
                </p>
                <Link
                  to="/branches"
                  className="press inline-flex h-10 px-4 rounded-[12px] bg-primary text-white text-[14px] font-semibold items-center gap-1.5"
                >
                  <Building2 size={16} /> Add branch
                </Link>
              </div>
            )}
            {!loadingBranches &&
              branches.map((b, i) => {
                const selected = activeBranchId === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => void selectBranch(b.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                      i < branches.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <span
                      className={`h-10 w-10 rounded-[12px] flex items-center justify-center ${
                        selected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <Building2 size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold">{b.name}</span>
                      <span className="block text-[12px] text-ink-muted">
                        {b.code || 'No code'}
                        {selected ? ' · This device' : ''}
                      </span>
                    </span>
                    {selected && <Check size={18} className="text-success shrink-0" />}
                  </button>
                )
              })}
          </div>
          {activeBranch && branches.length > 1 && (
            <p className="text-[12px] text-ink-muted mt-2 px-1">
              Sales on this device will use <strong>{activeBranch.name}</strong>.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Business</h2>
          <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
            <div>
              <label className="auth-label">Store name</label>
              <input
                className="field w-full"
                value={form.businessName}
                onChange={(e) => set({ businessName: e.target.value })}
              />
            </div>
            <div>
              <label className="auth-label">Phone</label>
              <input
                className="field w-full"
                value={form.businessPhone}
                onChange={(e) => set({ businessPhone: e.target.value })}
                inputMode="tel"
              />
            </div>
            <div>
              <label className="auth-label">Address</label>
              <input
                className="field w-full"
                value={form.businessAddress}
                onChange={(e) => set({ businessAddress: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Tax & currency</h2>
          <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
            <div>
              <label className="auth-label">Tax rate (%)</label>
              <input
                className="field w-full"
                inputMode="decimal"
                value={form.taxRate}
                onChange={(e) => set({ taxRate: e.target.value })}
              />
            </div>
            <label className="flex items-center justify-between gap-3 py-1">
              <span className="text-[15px] font-medium">Prices include tax</span>
              <input
                type="checkbox"
                checked={form.taxInclusive}
                onChange={(e) => set({ taxInclusive: e.target.checked })}
                className="h-5 w-5 rounded accent-primary"
              />
            </label>
            <div>
              <label className="auth-label">Currency</label>
              <input
                className="field w-full"
                value={form.currency}
                onChange={(e) => set({ currency: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold text-ink-secondary mb-2 px-1">Receipt</h2>
          <div className="bg-white rounded-[22px] shadow-card p-4 space-y-3">
            <div>
              <label className="auth-label">Footer message</label>
              <input
                className="field w-full"
                value={form.receiptFooter}
                onChange={(e) => set({ receiptFooter: e.target.value })}
                placeholder="Thank you for shopping!"
              />
            </div>
            <div className="rounded-[16px] bg-surface-secondary p-4 text-[13px] text-ink-secondary">
              <p className="font-semibold text-ink mb-1">{form.businessName || 'Your store'}</p>
              {activeBranch && <p className="text-ink-muted">{activeBranch.name}</p>}
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
              <input
                className="field w-full"
                inputMode="numeric"
                value={form.offlineWindowHours}
                onChange={(e) => set({ offlineWindowHours: e.target.value })}
              />
            </div>
            {settings?.deviceId && (
              <p className="text-[12px] text-ink-muted break-all">Device ID: {settings.deviceId}</p>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </Screen>
  )
}
