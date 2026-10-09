import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const [form, setForm] = useState({
    businessName: '',
    businessPhone: '',
    businessAddress: '',
    currency: 'TZS',
    taxRate: 18,
    taxInclusive: true,
    receiptFooter: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        businessName: settings.businessName || '',
        businessPhone: settings.businessPhone || '',
        businessAddress: settings.businessAddress || '',
        currency: settings.currency || 'TZS',
        taxRate: settings.taxRate ?? 18,
        taxInclusive: settings.taxInclusive ?? true,
        receiptFooter: settings.receiptFooter || '',
      })
    }
  }, [settings])

  const save = async () => {
    await db.settings.update('main', form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-sm text-ink-secondary">Business & receipt configuration</p>
        </div>
        <button
          onClick={save}
          className="flex items-center gap-2 h-10 px-4 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-smooth"
        >
          <Save size={16} />
          {saved ? 'Saved' : 'Save'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-pad">
        <div className="max-w-xl space-y-6">
          <section className="bg-white rounded-card shadow-card p-5 space-y-4">
            <h2 className="font-semibold text-ink">Business Information</h2>
            <Field label="Business Name" value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} />
            <Field label="Phone" value={form.businessPhone} onChange={(v) => setForm({ ...form, businessPhone: v })} />
            <Field label="Address" value={form.businessAddress} onChange={(v) => setForm({ ...form, businessAddress: v })} />
          </section>

          <section className="bg-white rounded-card shadow-card p-5 space-y-4">
            <h2 className="font-semibold text-ink">Tax & Currency</h2>
            <Field label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
            <Field
              label="Tax Rate (%)"
              value={String(form.taxRate)}
              type="number"
              onChange={(v) => setForm({ ...form, taxRate: parseFloat(v) || 0 })}
            />
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.taxInclusive}
                onChange={(e) => setForm({ ...form, taxInclusive: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-ink">Prices are tax-inclusive</span>
            </label>
          </section>

          <section className="bg-white rounded-card shadow-card p-5 space-y-4">
            <h2 className="font-semibold text-ink">Receipt</h2>
            <div>
              <label className="block text-sm text-ink-secondary mb-1.5">Footer message</label>
              <textarea
                value={form.receiptFooter}
                onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                rows={3}
                className="w-full px-3 py-2.5 rounded-button bg-surface-secondary border border-transparent focus:border-primary focus:bg-white outline-none transition-smooth text-sm resize-none"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-ink-secondary mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-button bg-surface-secondary border border-transparent focus:border-primary focus:bg-white outline-none transition-smooth text-sm"
      />
    </div>
  )
}
