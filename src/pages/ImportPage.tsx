import { useRef, useState } from 'react'
import { Download, FileUp } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { db, audit } from '../lib/db'
import Screen from '../components/ui/Screen'
import { useUi } from '../store/uiStore'
import { fmt } from '../lib/util'
import type { Product, Customer } from '../types'

type Kind = 'products' | 'customers'
interface RowError { row: number; message: string }

const TEMPLATES: Record<Kind, string> = {
  products: 'name,sku,barcode,category,unit,price,cost,stock,min_stock\nCoca Cola 500ml,BEV-010,6001234500011,Beverages,piece,1500,900,120,20\n',
  customers: 'name,phone,email,address,credit_limit\nAsha Juma,0712345678,,Kariakoo,50000\n',
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { q = false }
      else { cell += c }
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

function download(name: string, content: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
  a.download = name
  a.click()
}

export default function ImportPage() {
  const toast = useUi((s) => s.toast)
  const [kind, setKind] = useState<Kind>('products')
  const [fileName, setFileName] = useState('')
  const [valid, setValid] = useState<(Product | Customer)[]>([])
  const [errors, setErrors] = useState<RowError[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const reset = () => { setValid([]); setErrors([]); setFileName('') }

  const onFile = async (file?: File) => {
    if (!file) return
    reset()
    setFileName(file.name)
    const rows = parseCsv(await file.text())
    if (rows.length < 2) return toast('The file is empty or has no data rows', 'error')
    const head = rows[0].map((h) => h.trim().toLowerCase())
    const col = (r: string[], k: string) => (r[head.indexOf(k)] ?? '').trim()
    const now = new Date().toISOString()
    const ok: (Product | Customer)[] = []
    const errs: RowError[] = []

    if (kind === 'products') {
      const existing = await db.products.toArray()
      const barcodes = new Set(existing.map((p) => p.barcode).filter(Boolean))
      const skus = new Set(existing.map((p) => p.sku.toLowerCase()))
      rows.slice(1).forEach((r, i) => {
        const line = i + 2
        const name = col(r, 'name')
        const price = parseFloat(col(r, 'price'))
        const cost = parseFloat(col(r, 'cost') || '0')
        const stock = parseFloat(col(r, 'stock') || '0')
        const barcode = col(r, 'barcode')
        const sku = col(r, 'sku') || `IMP-${Math.floor(1000 + Math.random() * 9000)}`
        if (!name) return errs.push({ row: line, message: 'Name is required' })
        if (isNaN(price) || price < 0) return errs.push({ row: line, message: 'Price must be a number' })
        if (isNaN(cost) || isNaN(stock)) return errs.push({ row: line, message: 'Cost and stock must be numbers' })
        if (barcode && barcodes.has(barcode)) return errs.push({ row: line, message: `Barcode ${barcode} already exists` })
        if (skus.has(sku.toLowerCase())) return errs.push({ row: line, message: `SKU ${sku} already exists` })
        if (barcode) barcodes.add(barcode)
        skus.add(sku.toLowerCase())
        ok.push({
          id: uuidv4(), name, sku, barcode: barcode || undefined, price, cost, stock,
          minStock: col(r, 'min_stock') ? parseFloat(col(r, 'min_stock')) : undefined,
          category: col(r, 'category') || undefined, unit: col(r, 'unit') || 'piece',
          active: true, createdAt: now, updatedAt: now,
        })
      })
    } else {
      const existing = await db.customers.toArray()
      const phones = new Set(existing.map((c) => c.phone).filter(Boolean))
      rows.slice(1).forEach((r, i) => {
        const line = i + 2
        const name = col(r, 'name')
        const phone = col(r, 'phone')
        const limit = parseFloat(col(r, 'credit_limit') || '0')
        if (!name) return errs.push({ row: line, message: 'Name is required' })
        if (isNaN(limit)) return errs.push({ row: line, message: 'credit_limit must be a number' })
        if (phone && phones.has(phone)) return errs.push({ row: line, message: `Phone ${phone} already exists` })
        if (phone) phones.add(phone)
        ok.push({ id: uuidv4(), name, phone: phone || undefined, email: col(r, 'email') || undefined, address: col(r, 'address') || undefined, creditLimit: limit, balance: 0, createdAt: now, updatedAt: now })
      })
    }
    setValid(ok)
    setErrors(errs)
  }

  const commit = async () => {
    if (valid.length === 0) return
    setBusy(true)
    try {
      if (kind === 'products') {
        const items = valid as Product[]
        const now = new Date().toISOString()
        await db.transaction('rw', db.products, db.stockMovements, async () => {
          await db.products.bulkAdd(items)
          await db.stockMovements.bulkAdd(items.filter((p) => p.stock > 0).map((p) => ({
            id: uuidv4(), productId: p.id, productName: p.name, type: 'opening' as const, quantity: p.stock,
            previousStock: 0, newStock: p.stock, reason: 'Imported opening stock', userId: '', createdAt: now, synced: false,
          })))
        })
      } else {
        await db.customers.bulkAdd(valid as Customer[])
      }
      await audit('DATA_IMPORT', kind, undefined, { after: { imported: valid.length, skipped: errors.length }, reason: fileName })
      toast(`Imported ${valid.length} ${kind}`, 'success')
      reset()
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Import data" subtitle="Bring in products or customers from a CSV file">
      <div className="space-y-4 md:max-w-xl">
        <div className="grid grid-cols-2 p-1 rounded-[14px] bg-black/[0.06]">
          {(['products', 'customers'] as Kind[]).map((k) => (
            <button key={k} onClick={() => { setKind(k); reset() }} className={`h-9 rounded-[11px] text-[14px] font-semibold capitalize ${kind === k ? 'bg-white shadow-soft text-ink' : 'text-ink-secondary'}`}>{k}</button>
          ))}
        </div>

        <div className="bg-white rounded-[22px] shadow-card p-5 space-y-3">
          <p className="text-[15px] text-ink-secondary">
            {kind === 'products' ? 'Columns: name, sku, barcode, category, unit, price, cost, stock, min_stock. Stock becomes opening stock.' : 'Columns: name, phone, email, address, credit_limit.'} In Excel, use Save As → CSV.
          </p>
          <button onClick={() => download(`${kind}-template.csv`, TEMPLATES[kind])} className="press h-11 px-4 rounded-[14px] bg-black/[0.06] text-[15px] font-semibold flex items-center gap-2"><Download size={16} /> Download template</button>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => input.current?.click()} className="press w-full h-14 rounded-[16px] bg-primary text-white text-[16px] font-bold flex items-center justify-center gap-2 shadow-soft"><FileUp size={18} /> Choose CSV file</button>
        </div>

        {fileName && (
          <div className="bg-white rounded-[22px] shadow-card p-5">
            <p className="font-semibold text-[15px] truncate">{fileName}</p>
            <p className="mt-1 text-[15px]"><span className="text-success font-bold">{fmt(valid.length)} ready</span>{errors.length > 0 && <span className="text-danger font-bold"> · {fmt(errors.length)} with errors</span>}</p>
            {errors.length > 0 && (
              <>
                <ul className="mt-3 max-h-48 overflow-y-auto divide-y divide-border text-[14px]">
                  {errors.slice(0, 50).map((e) => <li key={e.row} className="py-1.5"><span className="font-semibold">Row {e.row}:</span> {e.message}</li>)}
                </ul>
                <button onClick={() => download('import-errors.csv', 'row,error\n' + errors.map((e) => `${e.row},"${e.message}"`).join('\n'))} className="mt-2 text-[14px] font-semibold text-primary">Download error report</button>
              </>
            )}
            <button onClick={commit} disabled={busy || valid.length === 0} className="press mt-4 w-full h-14 rounded-[16px] bg-ink text-white text-[16px] font-bold disabled:opacity-40">
              {busy ? 'Importing…' : `Import ${fmt(valid.length)} ${kind}`}
            </button>
          </div>
        )}
      </div>
    </Screen>
  )
}
