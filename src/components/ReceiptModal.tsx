import { useLiveQuery } from 'dexie-react-hooks'
import { X, Printer, Share2 } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../lib/db'
import type { Sale } from '../types'
import { fmt, fmtMoney } from '../lib/util'

interface Props {
  sale: Sale
  onClose: () => void
}

export default function ReceiptModal({ sale, onClose }: Props) {
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const currency = settings?.currency || 'TZS'

  const print = () => window.print()

  const share = async () => {
    const lines = [
      settings?.businessName || 'StockFlow',
      `Receipt ${sale.receiptNumber}`,
      format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm'),
      '',
      ...sale.items.map((i) => `${i.name}  ${i.quantity}×${fmt(i.price)} = ${fmt(i.lineTotal)}`),
      '',
      `Total: ${fmt(sale.total)} ${currency}`,
      ...sale.payments.map((p) => `${p.method}: ${fmt(p.amount)}`),
      settings?.receiptFooter || '',
    ]
    const text = lines.filter(Boolean).join('\n')
    if (navigator.share) {
      try {
        await navigator.share({ title: sale.receiptNumber, text })
        return
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-[28px] sm:rounded-[28px] shadow-float">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur border-b border-border rounded-t-[28px]">
          <h2 className="text-[17px] font-semibold">Receipt</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void share()} className="press h-9 w-9 rounded-full flex items-center justify-center text-primary" aria-label="Share">
              <Share2 size={18} />
            </button>
            <button type="button" onClick={print} className="press h-9 w-9 rounded-full flex items-center justify-center text-primary" aria-label="Print">
              <Printer size={18} />
            </button>
            <button type="button" onClick={onClose} className="press h-9 w-9 rounded-full bg-black/[0.06] flex items-center justify-center" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 text-[14px]" id="receipt-print">
          <div className="text-center mb-5">
            <p className="text-[18px] font-bold tracking-tight">{settings?.businessName || 'StockFlow'}</p>
            {settings?.businessPhone && <p className="text-[13px] text-ink-secondary">{settings.businessPhone}</p>}
            {settings?.businessAddress && <p className="text-[13px] text-ink-secondary">{settings.businessAddress}</p>}
          </div>

          <div className="space-y-1 text-[13px] text-ink-secondary mb-4">
            <div className="flex justify-between"><span>Receipt</span><span className="font-medium text-ink">{sale.receiptNumber}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{format(new Date(sale.createdAt), 'dd MMM yyyy HH:mm')}</span></div>
            {sale.cashierName && <div className="flex justify-between"><span>Cashier</span><span>{sale.cashierName}</span></div>}
            {sale.customerName && <div className="flex justify-between"><span>Customer</span><span>{sale.customerName}</span></div>}
            <div className="flex justify-between">
              <span>Status</span>
              <span className={`capitalize font-semibold ${sale.status === 'voided' ? 'text-danger' : 'text-success'}`}>{sale.status}</span>
            </div>
          </div>

          <div className="border-t border-border py-3 space-y-2.5">
            {sale.items.map((item, idx) => (
              <div key={`${item.productId}-${idx}`} className="flex justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">{item.name}</p>
                  <p className="text-[12px] text-ink-muted tabular-nums">
                    {item.quantity} × {fmt(item.price)}
                    {item.discount > 0 ? ` − ${fmt(item.discount)}` : ''}
                  </p>
                </div>
                <p className="tabular-nums font-medium shrink-0">{fmt(item.lineTotal)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span className="tabular-nums">{fmt(sale.subtotal)}</span></div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-ink-secondary"><span>Discount</span><span className="tabular-nums">−{fmt(sale.discount)}</span></div>
            )}
            {sale.tax > 0 && (
              <div className="flex justify-between text-ink-secondary"><span>Tax</span><span className="tabular-nums">{fmt(sale.tax)}</span></div>
            )}
            <div className="flex justify-between text-[16px] font-bold pt-1">
              <span>Total</span>
              <span className="tabular-nums">{fmtMoney(sale.total).replace(' TZS', '')} {currency}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border mt-3 pt-3 space-y-1 text-[13px] text-ink-secondary">
            {sale.payments.map((p, i) => (
              <div key={i} className="flex justify-between capitalize">
                <span>{p.method}</span>
                <span className="tabular-nums">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>

          {settings?.receiptFooter && (
            <p className="text-center text-[12px] text-ink-muted mt-5 leading-relaxed">{settings.receiptFooter}</p>
          )}
          <p className="text-center text-[10px] text-ink-muted mt-3">
            {sale.synced ? 'Synced' : 'Saved offline'} · StockFlow
          </p>
        </div>
      </div>
    </div>
  )
}
