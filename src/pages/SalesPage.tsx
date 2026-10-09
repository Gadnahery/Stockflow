import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Sale } from '../types'
import { format } from 'date-fns'
import ReceiptModal from '../components/ReceiptModal'
import { Receipt, Ban } from 'lucide-react'
import { usePosStore } from '../store/posStore'
import { usePermission } from '../hooks/usePermission'

export default function SalesPage() {
  const [selected, setSelected] = useState<Sale | null>(null)
  const voidSale = usePosStore((s) => s.voidSale)
  const { can } = usePermission()
  const sales = useLiveQuery(
    () => db.sales.orderBy('createdAt').reverse().limit(100).toArray(),
    []
  ) || []

  const handleVoid = async (sale: Sale) => {
    if (!can('VOID_SALE')) {
      alert('You do not have permission to void sales')
      return
    }
    if (sale.status !== 'completed') return
    if (!confirm(`Void receipt ${sale.receiptNumber}? Stock will be restored.`)) return
    try {
      await voidSale(sale.id)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 bg-white border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-ink">Sales History</h1>
        <p className="text-sm text-ink-secondary">{sales.length} recent sales</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-secondary">
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Cashier</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-border/60 hover:bg-surface-secondary/40 transition-smooth">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{s.receiptNumber}</p>
                    <p className="text-xs text-ink-muted sm:hidden">
                      {format(new Date(s.createdAt), 'dd MMM HH:mm')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary hidden sm:table-cell">
                    {s.cashierName || '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary hidden md:table-cell">
                    {format(new Date(s.createdAt), 'dd MMM yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {s.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      s.status === 'completed' ? 'bg-emerald-50 text-success' :
                      s.status === 'voided' ? 'bg-red-50 text-danger' :
                      'bg-surface-secondary text-ink-muted'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelected(s)}
                        className="inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline"
                      >
                        <Receipt size={14} />
                        View
                      </button>
                      {s.status === 'completed' && can('VOID_SALE') && (
                        <button
                          onClick={() => handleVoid(s)}
                          className="inline-flex items-center gap-1 text-danger text-xs font-medium hover:underline"
                        >
                          <Ban size={14} />
                          Void
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && (
            <p className="text-center text-ink-muted py-12">No sales yet</p>
          )}
        </div>
      </div>

      {selected && (
        <ReceiptModal sale={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
