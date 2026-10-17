import type { Sale } from '../types'
import type { PrintDocumentProps } from '../components/PrintDocument'
import { db } from './db'

/** Next invoice number INV-YYYY-NNNN sequential on this device */
export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const settings = await db.settings.get('main')
  const seq = (settings?.invoiceSeq ?? 0) + 1
  await db.settings.update('main', { invoiceSeq: seq })
  return `INV-${year}-${String(seq).padStart(4, '0')}`
}

export async function saleToInvoiceDoc(
  sale: Sale,
  opts?: { title?: 'Invoice' | 'Sales order' | 'Quote'; invoiceNo?: string },
): Promise<PrintDocumentProps> {
  const settings = await db.settings.get('main')
  const invoiceNo = opts?.invoiceNo || sale.receiptNumber || (await nextInvoiceNumber())
  return {
    title: opts?.title || 'Invoice',
    business: {
      name: settings?.businessName || 'StockFlow',
      address: settings?.businessAddress,
      phone: settings?.businessPhone,
      tin: settings?.tinNumber,
    },
    partyLabel: 'Customer',
    party: {
      name: sale.customerName || 'Walk-in customer',
    },
    numberLabel: 'Invoice no.',
    number: invoiceNo,
    dateLabel: 'Date',
    date: sale.createdAt,
    lines: sale.items.map((i) => ({
      description: i.name + (i.sellAs === 'pack' ? ' (jumla)' : ''),
      quantity: i.quantity,
      unitPrice: i.price,
    })),
    discount: sale.discount || undefined,
    tax: sale.tax || undefined,
    total: sale.total,
    paymentTerms: sale.payments?.map((p) => `${p.method} ${Math.round(p.amount).toLocaleString()} TZS`).join(', '),
    authorizedBy: sale.cashierName,
    note: sale.note,
    copies: 'Original: Customer / Copy: Accounts',
  }
}
