import { X, Printer, Share2 } from 'lucide-react'
import type { Sale } from '../types'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

interface Props {
  sale: Sale
  onClose: () => void
}

export default function ReceiptModal({ sale, onClose }: Props) {
  const settings = useLiveQuery(() => db.settings.get('main'), [])

  const handleShare = async () => {
    const f = (n: number) => Math.round(n).toLocaleString('en-US')
    const text = [
      `*${settings?.businessName || 'StockFlow Store'}*`,
      `Receipt ${sale.receiptNumber}`,
      format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm'),
      '',
      ...sale.items.map((i) => `${i.quantity} x ${i.name} - ${f(i.lineTotal)}`),
      '',
      `*Total: ${f(sale.total)} TZS*`,
      ...sale.payments.map((p) => `${p.method === 'credit' ? 'On credit' : p.method}: ${f(p.amount)}`),
      '',
      'Thank you!',
    ].join('\n')
    if (navigator.share) {
      try { await navigator.share({ title: `Receipt ${sale.receiptNumber}`, text }); return } catch { /* cancelled → fall back */ }
    }
    const cust = sale.customerId ? await db.customers.get(sale.customerId) : undefined
    const phone = cust?.phone?.replace(/\D/g, '')
    window.open(`https://wa.me/${phone || ''}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="sheet-backdrop">
      <div className="sheet-panel">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border print:hidden">
          <h2 className="text-lg font-semibold">Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 h-9 px-3 rounded-button bg-emerald-600 text-white text-sm font-medium"
            >
              <Share2 size={14} />
              Share
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 h-9 px-3 rounded-button bg-primary text-white text-sm font-medium"
            >
              <Printer size={14} />
              Print
            </button>
            <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 text-sm" id="receipt-content">
          <div className="text-center mb-5">
            <h3 className="text-lg font-semibold text-ink">
              {settings?.businessName || 'StockFlow Store'}
            </h3>
            {settings?.businessPhone && (
              <p className="text-ink-secondary text-xs mt-0.5">{settings.businessPhone}</p>
            )}
            {settings?.businessAddress && (
              <p className="text-ink-muted text-xs">{settings.businessAddress}</p>
            )}
          </div>

          <div className="border-t border-b border-dashed border-border py-3 space-y-1 text-xs text-ink-secondary">
            <div className="flex justify-between">
              <span>Receipt</span>
              <span className="font-medium text-ink">{sale.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date</span>
              <span>{format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm')}</span>
            </div>
            {sale.cashierName && (
              <div className="flex justify-between">
                <span>Cashier</span>
                <span>{sale.cashierName}</span>
              </div>
            )}
            {sale.customerName && (
              <div className="flex justify-between">
                <span>Customer</span>
                <span>{sale.customerName}</span>
              </div>
            )}
          </div>

          <div className="py-4 space-y-2">
            {sale.items.map((item) => (
              <div key={item.productId} className="flex justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-medium truncate">{item.name}</p>
                  <p className="text-xs text-ink-muted tabular-nums">
                    {item.quantity} × {item.price.toLocaleString()}
                  </p>
                </div>
                <p className="tabular-nums font-medium text-ink shrink-0">
                  {item.lineTotal.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between text-ink-secondary">
              <span>Subtotal</span>
              <span className="tabular-nums">{sale.subtotal.toLocaleString()}</span>
            </div>
            {sale.tax > 0 && (
              <div className="flex justify-between text-ink-secondary">
                <span>Tax</span>
                <span className="tabular-nums">{sale.tax.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-ink pt-1">
              <span>Total</span>
              <span className="tabular-nums">{sale.total.toLocaleString()} {settings?.currency || 'TZS'}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border mt-3 pt-3 space-y-1 text-xs text-ink-secondary">
            {sale.payments.map((p, i) => (
              <div key={i} className="flex justify-between capitalize">
                <span>{p.method}</span>
                <span className="tabular-nums">{p.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {settings?.receiptFooter && (
            <p className="text-center text-xs text-ink-muted mt-5">{settings.receiptFooter}</p>
          )}

          <p className="text-center text-[10px] text-ink-muted mt-3">
            {sale.synced ? 'Synced' : 'Saved offline'} · Powered by StockFlow
          </p>
        </div>
      </div>
    </div>
  )
}
