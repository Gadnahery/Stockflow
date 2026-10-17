import { format } from 'date-fns'
import { Printer } from 'lucide-react'
import Sheet from './ui/Sheet'

export interface DocLine { description: string; quantity: number; unitPrice: number }

export interface PrintDocumentProps {
  title: string // "Purchase Order" | "Invoice"
  business: { name: string; address?: string; phone?: string; tin?: string }
  partyLabel: string // "Supplier" | "Customer"
  party: { name: string; phone?: string; email?: string; address?: string }
  numberLabel: string // "PO no." | "Invoice no."
  number: string
  dateLabel: string // "PO date" | "Date"
  date: string // ISO
  lines: DocLine[]
  discount?: number
  tax?: number
  total: number
  deliveryAddress?: string
  deliveryDate?: string
  paymentTerms?: string
  authorizedBy?: string
  note?: string
  /** e.g. "Original: Supplier / Copy 1: Warehouse / Copy 2: Accounts" */
  copies?: string
}

const money = (n: number) => Math.round(n).toLocaleString('en-US')
const MIN_ROWS = 10

/** A4 business document laid out like a classic purchase order / invoice form. */
export function PrintDocument(p: PrintDocumentProps) {
  const blanks = Math.max(0, MIN_ROWS - p.lines.length)
  return (
    <div id="print-document" className="bg-white text-black text-[12px] leading-snug p-6 w-full max-w-[760px] mx-auto border border-black/10">
      <h1 className="text-center text-[22px] font-bold mb-4">{p.title}</h1>

      <div className="flex justify-between gap-6 mb-4">
        <div className="space-y-0.5 min-w-0">
          <p className="font-semibold">{p.business.name}</p>
          {p.business.address && <p>{p.business.address}</p>}
          {p.business.phone && <p>Tel: {p.business.phone}</p>}
          {p.business.tin && <p>TIN: {p.business.tin}</p>}
        </div>
        <div className="space-y-0.5 text-right min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-black/60">{p.partyLabel}</p>
          <p className="font-semibold">{p.party.name}</p>
          {p.party.address && <p>{p.party.address}</p>}
          {p.party.phone && <p>Tel: {p.party.phone}</p>}
          {p.party.email && <p>{p.party.email}</p>}
        </div>
      </div>

      <div className="flex justify-between mb-3 font-semibold">
        <p>{p.numberLabel}: <span className="font-normal">{p.number}</span></p>
        <p>{p.dateLabel}: <span className="font-normal">{format(new Date(p.date), 'dd MMM yyyy')}</span></p>
      </div>

      <table className="w-full border-collapse border border-black/40">
        <thead>
          <tr className="bg-black/10">
            <th className="border border-black/40 px-2 py-1 text-left w-[14%]">Quantity</th>
            <th className="border border-black/40 px-2 py-1 text-left">Description</th>
            <th className="border border-black/40 px-2 py-1 text-right w-[18%]">Unit Price</th>
            <th className="border border-black/40 px-2 py-1 text-right w-[18%]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {p.lines.map((l, i) => (
            <tr key={i}>
              <td className="border border-black/40 px-2 py-1 tabular-nums">{l.quantity}</td>
              <td className="border border-black/40 px-2 py-1">{l.description}</td>
              <td className="border border-black/40 px-2 py-1 text-right tabular-nums">{money(l.unitPrice)}</td>
              <td className="border border-black/40 px-2 py-1 text-right tabular-nums">{money(l.quantity * l.unitPrice)}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }).map((_, i) => (
            <tr key={`b${i}`}>{[0, 1, 2, 3].map((c) => <td key={c} className="border border-black/40 px-2 py-1">&nbsp;</td>)}</tr>
          ))}
          {!!p.discount && (
            <tr><td colSpan={3} className="border border-black/40 px-2 py-1 text-right">Discount</td><td className="border border-black/40 px-2 py-1 text-right tabular-nums">-{money(p.discount)}</td></tr>
          )}
          {!!p.tax && (
            <tr><td colSpan={3} className="border border-black/40 px-2 py-1 text-right">Tax (included)</td><td className="border border-black/40 px-2 py-1 text-right tabular-nums">{money(p.tax)}</td></tr>
          )}
          <tr className="bg-black/10 font-bold">
            <td colSpan={3} className="border border-black/40 px-2 py-1">Total</td>
            <td className="border border-black/40 px-2 py-1 text-right tabular-nums">{money(p.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-between gap-6 mt-4">
        <div className="space-y-0.5 min-w-0">
          <p className="font-semibold">Delivery Address</p>
          <p>{p.deliveryAddress || p.business.address || '—'}</p>
        </div>
        <div className="space-y-0.5 text-right">
          <p><span className="font-semibold">Delivery Date:</span> {p.deliveryDate ? format(new Date(p.deliveryDate), 'dd MMM yyyy') : '—'}</p>
          <p><span className="font-semibold">Payment Terms:</span> {p.paymentTerms || '—'}</p>
        </div>
      </div>

      {p.note && <p className="mt-3"><span className="font-semibold">Note:</span> {p.note}</p>}

      <div className="flex justify-between items-end mt-10">
        <p><span className="font-semibold">Authorised by:</span> {p.authorizedBy || '______________________'}</p>
        <p><span className="font-semibold">Date:</span> ______________</p>
      </div>
      {p.copies && <p className="mt-6 text-[10px] text-black/60">{p.copies}</p>}
    </div>
  )
}

/** Print only the document (works with "Save as PDF" on phones too). */
export function printDocument() {
  const src = document.getElementById('print-document')
  if (!src) return
  const root = document.createElement('div')
  root.id = 'print-root'
  root.innerHTML = src.outerHTML
  document.body.appendChild(root)
  document.body.classList.add('printing-doc')
  const cleanup = () => {
    root.remove()
    document.body.classList.remove('printing-doc')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  setTimeout(cleanup, 120_000)
  window.print()
}

export function DocumentModal({ open, onClose, title, doc }: { open: boolean; onClose: () => void; title: string; doc: PrintDocumentProps | null }) {
  return (
    <Sheet
      open={open && !!doc}
      onClose={onClose}
      title={title}
      footer={
        <button type="button" onClick={printDocument} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold flex items-center justify-center gap-2">
          <Printer size={18} /> Print / Save as PDF
        </button>
      }
    >
      <div className="overflow-x-auto -mx-2">{doc && <PrintDocument {...doc} />}</div>
    </Sheet>
  )
}
