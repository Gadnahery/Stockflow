import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import Screen from '../components/ui/Screen'
import { useUi } from '../store/uiStore'
import { format } from 'date-fns'
import { useI18n } from '../i18n/I18nContext'

type Dataset = 'products' | 'customers' | 'sales' | 'expenses' | 'suppliers'

const DATASETS: { id: Dataset; label: string; desc: string }[] = [
  { id: 'products', label: 'Products', desc: 'Catalogue, prices, stock' },
  { id: 'customers', label: 'Customers', desc: 'Contacts and credit balances' },
  { id: 'sales', label: 'Sales', desc: 'Receipts and totals' },
  { id: 'expenses', label: 'Expenses', desc: 'Costs by category' },
  { id: 'suppliers', label: 'Suppliers', desc: 'Supplier directory' },
]

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const { t } = useI18n()
  const toast = useUi((s) => s.toast)
  const [dataset, setDataset] = useState<Dataset>('products')
  const [busy, setBusy] = useState(false)

  const products = useLiveQuery(() => db.products.toArray(), [])
  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const sales = useLiveQuery(() => db.sales.orderBy('createdAt').reverse().limit(2000).toArray(), [])
  const expenses = useLiveQuery(() => db.expenses.toArray(), [])
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), [])

  const run = async () => {
    setBusy(true)
    try {
      const stamp = format(new Date(), 'yyyyMMdd-HHmm')
      let rows: Record<string, unknown>[] = []
      if (dataset === 'products') {
        rows = (products || []).map((p) => ({
          name: p.name, sku: p.sku, barcode: p.barcode || '', price: p.price, cost: p.cost,
          stock: p.stock, category: p.category || '', unit: p.unit || '', active: p.active,
        }))
      } else if (dataset === 'customers') {
        rows = (customers || []).map((c) => ({
          name: c.name, phone: c.phone || '', email: c.email || '', creditLimit: c.creditLimit, balance: c.balance,
        }))
      } else if (dataset === 'sales') {
        rows = (sales || []).map((s) => ({
          receipt: s.receiptNumber, date: s.createdAt, total: s.total, status: s.status,
          cashier: s.cashierName || '', customer: s.customerName || '',
        }))
      } else if (dataset === 'expenses') {
        rows = (expenses || []).map((e) => ({
          date: e.createdAt, category: e.category, amount: e.amount, method: e.paymentMethod, note: e.note || '',
        }))
      } else {
        rows = (suppliers || []).map((s) => ({
          name: s.name, phone: s.phone || '', email: s.email || '', balance: s.balance,
        }))
      }
      if (!rows.length) {
        toast('Nothing to export', 'error')
        return
      }
      download(`stockflow-${dataset}-${stamp}.csv`, toCsv(rows))
      toast(`Exported ${rows.length} rows`, 'success')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={t('export.title')} subtitle={t('export.sub')}>
      <div className="space-y-5 md:max-w-lg pb-8">
        <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
          {DATASETS.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDataset(d.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${i < DATASETS.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                dataset === d.id ? 'border-primary' : 'border-black/20'
              }`}>
                {dataset === d.id && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">{d.label}</span>
                <span className="block text-[13px] text-ink-muted">{d.desc}</span>
              </span>
              <FileSpreadsheet size={18} className="text-ink-muted shrink-0" />
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Download size={18} />
          {busy ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>
    </Screen>
  )
}
