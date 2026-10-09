import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { Download } from 'lucide-react'
import { format } from 'date-fns'

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const sales = useLiveQuery(() => db.sales.toArray(), []) || []
  const products = useLiveQuery(() => db.products.toArray(), []) || []
  const customers = useLiveQuery(() => db.customers.toArray(), []) || []
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) || []

  const exportSales = () => {
    const rows = [
      ['Receipt', 'Date', 'Cashier', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Status'],
      ...sales.map(s => [
        s.receiptNumber,
        format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm'),
        s.cashierName || '',
        s.customerName || '',
        s.subtotal,
        s.tax,
        s.discount,
        s.total,
        s.status,
      ]),
    ]
    downloadCSV(`sales-${format(new Date(), 'yyyyMMdd')}.csv`, rows.map(r => r.map(String)))
  }

  const exportProducts = () => {
    const rows = [
      ['Name', 'SKU', 'Barcode', 'Price', 'Cost', 'Stock', 'Min Stock', 'Category', 'Active'],
      ...products.map(p => [
        p.name, p.sku, p.barcode || '', p.price, p.cost, p.stock, p.minStock ?? '', p.category || '', p.active ? 'yes' : 'no',
      ]),
    ]
    downloadCSV(`products-${format(new Date(), 'yyyyMMdd')}.csv`, rows.map(r => r.map(String)))
  }

  const exportCustomers = () => {
    const rows = [
      ['Name', 'Phone', 'Email', 'Balance', 'Credit Limit'],
      ...customers.map(c => [c.name, c.phone || '', c.email || '', c.balance, c.creditLimit]),
    ]
    downloadCSV(`customers-${format(new Date(), 'yyyyMMdd')}.csv`, rows.map(r => r.map(String)))
  }

  const exportExpenses = () => {
    const rows = [
      ['Date', 'Category', 'Amount', 'Method', 'Note'],
      ...expenses.map(e => [
        format(new Date(e.createdAt), 'yyyy-MM-dd HH:mm'),
        e.category, e.amount, e.paymentMethod, e.note || '',
      ]),
    ]
    downloadCSV(`expenses-${format(new Date(), 'yyyyMMdd')}.csv`, rows.map(r => r.map(String)))
  }

  const cards = [
    { title: 'Sales', count: sales.length, action: exportSales },
    { title: 'Products', count: products.length, action: exportProducts },
    { title: 'Customers', count: customers.length, action: exportCustomers },
    { title: 'Expenses', count: expenses.length, action: exportExpenses },
  ]

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 bg-white border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-ink">Export Data</h1>
        <p className="text-sm text-ink-secondary">Download CSV files for backup or analysis</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          {cards.map(card => (
            <button
              key={card.title}
              onClick={card.action}
              className="bg-white rounded-card shadow-card p-5 text-left hover:shadow-soft transition-smooth flex items-center gap-4"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Download size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-ink">{card.title}</p>
                <p className="text-sm text-ink-secondary">{card.count} records · CSV</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
