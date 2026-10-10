import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, X, Trash2, ScanLine, Camera, ImagePlus, Sparkles, Package } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { db, audit } from '../lib/db'
import type { Product } from '../types'
import { usePermission } from '../hooks/usePermission'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import BarcodeScanner from '../components/ui/BarcodeScanner'
import ProductImage from '../components/ui/ProductImage'
import { useUi } from '../store/uiStore'
import { fileToDataUrl } from '../lib/image'
import { fmt, generateBarcode, makeSku } from '../lib/util'

const UNITS = ['piece', 'kg', 'g', 'litre', 'bottle', 'packet', 'bag', 'box', 'dozen']

const emptyForm = {
  name: '', sku: '', barcode: '', price: '', cost: '', stock: '', minStock: '', category: '', unit: 'piece', imageUrl: '',
}

export default function ProductsPage() {
  const { can } = usePermission()
  const toast = useUi((s) => s.toast)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [scanFor, setScanFor] = useState<'search' | 'barcode' | null>(null)
  const [saving, setSaving] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const productsQ = useLiveQuery(
    () => db.products.filter((p) => p.active).toArray().then((arr) => arr.sort((a, b) => a.name.localeCompare(b.name))),
    []
  )
  const products = useMemo(() => productsQ ?? [], [productsQ])
  const loading = productsQ === undefined
  const canManage = can('MANAGE_PRODUCTS')

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort()],
    [products]
  )

  const filtered = products.filter((p) => {
    const q = query.trim().toLowerCase()
    const matches = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))
    return matches && (category === 'All' || p.category === category)
  })

  const set = (patch: Partial<typeof emptyForm>) => setForm((f) => ({ ...f, ...patch }))

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (p: Product) => {
    if (!canManage) return
    setEditing(p)
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode || '', price: String(p.price), cost: String(p.cost),
      stock: String(p.stock), minStock: p.minStock != null ? String(p.minStock) : '', category: p.category || '',
      unit: p.unit || 'piece', imageUrl: p.imageUrl || '',
    })
    setShowForm(true)
  }

  const onPickImage = async (file?: File | null) => {
    if (!file) return
    try {
      set({ imageUrl: await fileToDataUrl(file) })
    } catch {
      toast('Could not read that photo. Try another one.', 'error')
    }
  }

  const handleScan = (code: string) => {
    if (scanFor === 'search') {
      setQuery(code)
      const hit = products.find((p) => p.barcode === code)
      toast(hit ? hit.name : `No product with code ${code}`, hit ? 'success' : 'info')
    } else {
      const dupe = products.find((p) => p.barcode === code && p.id !== editing?.id)
      if (dupe) toast(`Already used by ${dupe.name}`, 'error')
      else toast('Barcode captured', 'success')
      set({ barcode: code })
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm(`Deactivate "${editing.name}"? It will be hidden from POS.`)) return
    await db.products.update(editing.id, { active: false, updatedAt: new Date().toISOString() })
    setShowForm(false)
    toast('Product deactivated', 'info')
  }

  const save = async () => {
    const name = form.name.trim()
    if (!name) return toast('Enter a product name', 'error')
    if (form.price === '' || isNaN(parseFloat(form.price))) return toast('Enter a selling price', 'error')
    const barcode = form.barcode.trim()
    const dupe = barcode && products.find((p) => p.barcode === barcode && p.id !== editing?.id)
    if (dupe) return toast(`Barcode already used by ${dupe.name}`, 'error')

    setSaving(true)
    const now = new Date().toISOString()
    const data = {
      name,
      sku: form.sku.trim() || makeSku(name, form.category),
      barcode: barcode || undefined,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseFloat(form.stock) || 0,
      minStock: form.minStock ? parseFloat(form.minStock) : undefined,
      category: form.category.trim() || undefined,
      unit: form.unit || 'piece',
      imageUrl: form.imageUrl || undefined,
      active: true,
      updatedAt: now,
    }
    try {
      let uid: string | undefined
      try { uid = JSON.parse(sessionStorage.getItem('currentUser') || '{}').id } catch { /* none */ }
      const movement = (productId: string, prev: number, next: number, type: 'adjustment' | 'opening', reason: string) =>
        db.stockMovements.add({ id: uuidv4(), productId, productName: name, type, quantity: next - prev, previousStock: prev, newStock: next, reason, userId: uid ?? '', createdAt: now, synced: false })
      if (editing) {
        await db.products.update(editing.id, data)
        if (editing.price !== data.price || editing.cost !== data.cost) {
          await audit('PRICE_CHANGE', 'product', editing.id, { before: { price: editing.price, cost: editing.cost }, after: { price: data.price, cost: data.cost }, reason: name })
        }
        if (editing.stock !== data.stock) {
          await movement(editing.id, editing.stock, data.stock, 'adjustment', 'Edited in product form')
          await audit('STOCK_ADJUST', 'product', editing.id, { before: { stock: editing.stock }, after: { stock: data.stock }, reason: name })
        }
      } else {
        const id = uuidv4()
        await db.products.add({ id, ...data, createdAt: now })
        if (data.stock > 0) await movement(id, 0, data.stock, 'opening', 'Opening stock')
      }
      toast(editing ? 'Changes saved' : 'Product added', 'success')
      setShowForm(false)
    } catch {
      toast('Could not save product', 'error')
    } finally {
      setSaving(false)
    }
  }

  const price = parseFloat(form.price)
  const cost = parseFloat(form.cost)
  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null

  return (
    <>
      <Screen
        title="Products"
        subtitle={loading ? ' ' : `${products.length} ${products.length === 1 ? 'item' : 'items'}`}
        action={canManage && (
          <button onClick={openCreate} aria-label="Add product" className="press h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shadow-soft">
            <Plus size={22} strokeWidth={2.6} />
          </button>
        )}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search or scan" className="field !bg-black/[0.06] pl-10 pr-10 focus:!bg-white" />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/20 text-white flex items-center justify-center">
                <X size={13} strokeWidth={3} />
              </button>
            )}
          </div>
          <button onClick={() => setScanFor('search')} aria-label="Scan barcode" className="press h-[46px] w-[46px] shrink-0 rounded-[14px] bg-white shadow-card text-primary flex items-center justify-center">
            <ScanLine size={22} />
          </button>
        </div>

        {categories.length > 2 && (
          <div className="mt-3 -mx-5 px-5 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`press shrink-0 h-9 px-4 rounded-full text-[14px] font-semibold ${category === c ? 'bg-ink text-white' : 'bg-black/[0.06] text-ink-secondary'}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-[76px]" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto h-16 w-16 rounded-full bg-black/[0.05] text-ink-muted flex items-center justify-center"><Package size={28} /></div>
              <p className="mt-4 text-[17px] font-semibold">{products.length === 0 ? 'No products yet' : 'Nothing matches'}</p>
              <p className="text-[15px] text-ink-secondary mt-1">{products.length === 0 ? 'Add your first product to start selling.' : 'Check the spelling or scan the barcode.'}</p>
              {canManage && products.length === 0 && (
                <button onClick={openCreate} className="press mt-5 h-11 px-6 rounded-full bg-primary text-white font-semibold">Add product</button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-[22px] shadow-card divide-y divide-border overflow-hidden md:bg-transparent md:shadow-none md:overflow-visible md:divide-y-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-3">
              {filtered.map((p) => {
                const out = p.stock <= 0
                const low = !out && p.stock <= (p.minStock ?? 0)
                return (
                  <button
                    key={p.id}
                    onClick={() => openEdit(p)}
                    className="w-full flex items-center gap-3.5 p-3.5 text-left active:bg-black/[0.04] transition-colors md:bg-white md:rounded-[22px] md:shadow-card"
                  >
                    <ProductImage name={p.name} src={p.imageUrl} className="h-[54px] w-[54px] rounded-[15px] shrink-0" textClass="text-xl" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[16px] text-ink truncate">{p.name}</p>
                      <p className="text-[13px] text-ink-muted truncate">{p.category ? `${p.category} • ` : ''}{p.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[16px] tabular-nums tracking-tight">{fmt(p.price)}</p>
                      <span className={`inline-block mt-0.5 text-[12px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${out ? 'bg-red-50 text-danger' : low ? 'bg-amber-50 text-warning' : 'bg-black/[0.05] text-ink-secondary'}`}>
                        {out ? 'Out' : `${fmt(p.stock)} in stock`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Screen>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit product' : 'New product'}
        footer={
          <button onClick={save} disabled={saving} className="press w-full h-14 rounded-[16px] bg-primary text-white text-[17px] font-bold disabled:opacity-50 shadow-soft">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
          </button>
        }
      >
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative h-[104px] w-[104px] shrink-0">
            <ProductImage name={form.name || 'P'} src={form.imageUrl} className="h-full w-full rounded-[24px]" textClass="text-4xl" />
            {form.imageUrl && (
              <button onClick={() => set({ imageUrl: '' })} aria-label="Remove photo" className="press absolute -top-2 -right-2 h-7 w-7 rounded-full bg-ink text-white flex items-center justify-center shadow-soft">
                <X size={14} strokeWidth={3} />
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <button onClick={() => cameraRef.current?.click()} className="press w-full h-11 rounded-[14px] bg-primary/10 text-primary text-[15px] font-semibold flex items-center justify-center gap-2">
              <Camera size={18} /> Take photo
            </button>
            <button onClick={() => galleryRef.current?.click()} className="press w-full h-11 rounded-[14px] bg-black/[0.06] text-ink text-[15px] font-semibold flex items-center justify-center gap-2">
              <ImagePlus size={18} /> Choose from gallery
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = '' }} />
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Name">
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Coca Cola 500ml" className="field" autoComplete="off" />
          </Field>

          <Field label="Barcode">
            <div className="flex gap-2">
              <input value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} inputMode="numeric" placeholder="Scan or type" className="field flex-1 tabular-nums" />
              <button onClick={() => setScanFor('barcode')} aria-label="Scan barcode" className="press h-[46px] w-[46px] rounded-[14px] bg-primary text-white flex items-center justify-center shrink-0">
                <ScanLine size={20} />
              </button>
              <button onClick={() => { set({ barcode: generateBarcode() }); toast('Barcode generated', 'info') }} aria-label="Generate barcode" className="press h-[46px] w-[46px] rounded-[14px] bg-black/[0.06] text-ink flex items-center justify-center shrink-0">
                <Sparkles size={19} />
              </button>
            </div>
            <p className="mt-1.5 text-[12px] text-ink-muted">No printed barcode? Tap the sparkle to make one you can label the item with.</p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Selling price (TZS)">
              <input value={form.price} onChange={(e) => set({ price: e.target.value })} type="number" inputMode="decimal" placeholder="0" className="field tabular-nums" />
            </Field>
            <Field label="Cost (TZS)">
              <input value={form.cost} onChange={(e) => set({ cost: e.target.value })} type="number" inputMode="decimal" placeholder="0" className="field tabular-nums" />
            </Field>
          </div>
          {margin !== null && (
            <p className={`-mt-1 text-[13px] font-semibold ${margin >= 0 ? 'text-success' : 'text-danger'}`}>
              Profit {fmt(price - cost)} per item · {margin}% margin
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="In stock">
              <input value={form.stock} onChange={(e) => set({ stock: e.target.value })} type="number" inputMode="decimal" placeholder="0" className="field tabular-nums" />
            </Field>
            <Field label="Low-stock alert at">
              <input value={form.minStock} onChange={(e) => set({ minStock: e.target.value })} type="number" inputMode="decimal" placeholder="0" className="field tabular-nums" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input value={form.category} onChange={(e) => set({ category: e.target.value })} list="category-list" placeholder="e.g. Beverages" className="field" />
              <datalist id="category-list">{categories.filter((c) => c !== 'All').map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Unit">
              <select value={form.unit} onChange={(e) => set({ unit: e.target.value })} className="field appearance-none bg-no-repeat">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          <Field label="SKU">
            <input value={form.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="Leave empty to generate" className="field" autoCapitalize="characters" />
          </Field>

          {editing && (
            <button onClick={handleDelete} className="press w-full h-12 rounded-[14px] text-danger text-[15px] font-semibold flex items-center justify-center gap-2 bg-red-50">
              <Trash2 size={16} /> Deactivate product
            </button>
          )}
        </div>
      </Sheet>

      {scanFor && <BarcodeScanner title={scanFor === 'search' ? 'Find by barcode' : 'Scan product barcode'} onDetect={handleScan} onClose={() => setScanFor(null)} />}
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-ink-secondary mb-1.5">{label}</label>
      {children}
    </div>
  )
}
