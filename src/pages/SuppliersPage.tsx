import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, Truck, PackagePlus, Trash2, Printer, PackageCheck } from 'lucide-react'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import type { Supplier, PurchaseOrder } from '../types'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { fmtMoney } from '../lib/util'
import { DocumentModal, type PrintDocumentProps } from '../components/PrintDocument'
import { applyReceipt, nextPoNumber, remainingQty, PO_STATUS_LABEL } from '../lib/purchaseOrders'

const emptySupplier = { name: '', phone: '', email: '', address: '', notes: '' }

export default function SuppliersPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'suppliers' | 'purchases'>('suppliers')
  const [query, setQuery] = useState('')
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptySupplier)
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('')
  const [purchaseItems, setPurchaseItems] = useState<{ productId: string; name: string; quantity: string; cost: string }[]>([
    { productId: '', name: '', quantity: '1', cost: '' },
  ])
  const [purchaseNote, setPurchaseNote] = useState('')
  const [purchaseMode, setPurchaseMode] = useState<'order' | 'grn'>('order')
  const [expectedDate, setExpectedDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [docPo, setDocPo] = useState<PurchaseOrder | null>(null)
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null)
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({})
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | PurchaseOrder['status']>('all')
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const [showDetail, setShowDetail] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null)

  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])
  const purchases = useLiveQuery(() => db.purchases.orderBy('createdAt').reverse().toArray(), [])
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), [])
  const loading = suppliers === undefined
  const totalPayable = (suppliers || []).reduce((t, s) => t + (s.balance > 0 ? s.balance : 0), 0)

  const filtered = useMemo(() => {
    const list = suppliers || []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)))
  }, [suppliers, query])

  const openCreateSupplier = () => {
    setEditing(null)
    setForm(emptySupplier)
    setShowSupplierForm(true)
  }

  const openEditSupplier = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || '',
    })
    setShowSupplierForm(true)
  }

  const handleDeleteSupplier = async () => {
    if (!editing) return
    const ok = await confirm({
      title: 'Delete supplier?',
      message: `"${editing.name}" will be removed.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    await db.suppliers.delete(editing.id)
    setShowSupplierForm(false)
  }

  const saveSupplier = async () => {
    if (!form.name.trim()) return
    const now = new Date().toISOString()
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      updatedAt: now,
    }
    if (editing) {
      await db.suppliers.update(editing.id, data)
    } else {
      await db.suppliers.add({ id: uuidv4(), ...data, balance: 0, createdAt: now })
    }
    setShowSupplierForm(false)
  }

  const openPurchase = (mode: 'order' | 'grn' = 'order') => {
    setPurchaseMode(mode)
    setExpectedDate('')
    setPaymentTerms('')
    setDeliveryAddress(settings?.businessAddress || '')
    const list = suppliers || []
    setPurchaseSupplierId(list[0]?.id || '')
    setPurchaseItems([{ productId: '', name: '', quantity: '1', cost: '' }])
    setPurchaseNote('')
    setShowPurchaseForm(true)
  }

  const updatePurchaseLine = (idx: number, field: string, value: string) => {
    const next = [...purchaseItems]
    const productList = products || []
    if (field === 'productId') {
      const product = productList.find((p) => p.id === value)
      next[idx] = {
        ...next[idx],
        productId: value,
        name: product?.name || '',
        cost: product ? String(product.cost) : next[idx].cost,
      }
    } else {
      next[idx] = { ...next[idx], [field]: value }
    }
    setPurchaseItems(next)
  }

  const cancelPo = async (po: PurchaseOrder) => {
    if (po.status === 'received' || po.status === 'cancelled') return
    try {
      await db.purchases.update(po.id, { status: 'cancelled', synced: false })
      toast('Purchase order cancelled', 'success')
    } catch (e) {
      toast((e as Error).message || 'Could not cancel', 'error')
    }
  }

  const openReceive = (po: PurchaseOrder) => {
    setReceivePo(po)
    setReceiveQty(Object.fromEntries(po.items.map((i) => [i.productId, String(remainingQty(i))])))
  }

  const confirmReceive = async () => {
    if (!receivePo) return
    const now = new Date().toISOString()
    const { po: updated, received, value } = applyReceipt(
      receivePo, Object.fromEntries(Object.entries(receiveQty).map(([k, v]) => [k, parseFloat(v) || 0])), now,
    )
    if (received.length === 0) { setReceivePo(null); return }
    const user = (() => { try { return JSON.parse(sessionStorage.getItem('currentUser') || '{}') as { id?: string } } catch { return {} } })()
    await db.transaction('rw', [db.purchases, db.products, db.stockMovements, db.suppliers, db.outbox], async () => {
      await db.purchases.put(updated)
      for (const r of received) {
        const product = await db.products.get(r.productId)
        if (!product) continue
        const newStock = product.stock + r.qty
        await db.products.update(r.productId, { stock: newStock, cost: r.cost, updatedAt: now })
        await db.stockMovements.add({
          id: uuidv4(), productId: r.productId, productName: r.name, type: 'purchase', quantity: r.qty,
          previousStock: product.stock, newStock, referenceId: updated.id, reason: `Received on ${updated.poNumber ?? 'order'}`,
          userId: user.id, createdAt: now, synced: false,
        })
      }
      const supplier = await db.suppliers.get(updated.supplierId)
      if (supplier) await db.suppliers.update(supplier.id, { balance: (supplier.balance || 0) + value, updatedAt: now })
      await db.outbox.add({ id: uuidv4(), type: 'purchase', payload: updated, createdAt: now, retries: 0 })
    })
    setReceivePo(null)
  }

  const poDoc = (po: PurchaseOrder): PrintDocumentProps => {
    const sup = (suppliers || []).find((x) => x.id === po.supplierId)
    return {
      title: 'Purchase Order',
      business: { name: settings?.businessName || 'StockFlow', address: settings?.businessAddress, phone: settings?.businessPhone, tin: settings?.tinNumber },
      partyLabel: 'Supplier',
      party: { name: po.supplierName, phone: sup?.phone, email: sup?.email, address: sup?.address },
      numberLabel: 'PO no.', number: po.poNumber || po.id.slice(0, 8).toUpperCase(),
      dateLabel: 'PO date', date: po.createdAt,
      lines: po.items.map((i) => ({ description: i.name, quantity: i.quantity, unitPrice: i.cost })),
      total: po.total, deliveryAddress: po.deliveryAddress, deliveryDate: po.expectedDate,
      paymentTerms: po.paymentTerms, authorizedBy: po.authorizedBy, note: po.note,
      copies: 'Original: Supplier / Copy 1: Warehouse / Copy 2: Accounts',
    }
  }

  const savePurchase = async () => {
    const list = suppliers || []
    const supplier = list.find((s) => s.id === purchaseSupplierId)
    if (!supplier) return
    const items = purchaseItems
      .filter((i) => i.productId && parseFloat(i.quantity) > 0)
      .map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: parseInt(i.quantity, 10) || 0,
        cost: parseFloat(i.cost) || 0,
      }))
    if (items.length === 0) return

    const total = items.reduce((s, i) => s + i.quantity * i.cost, 0)
    const now = new Date().toISOString()
    const user = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('currentUser') || '{}') as { id?: string; name?: string }
      } catch {
        return {}
      }
    })()

    const poNumber = nextPoNumber(await db.purchases.toArray())
    if (purchaseMode === 'order') {
      // A purchase ORDER: nothing is received yet, so stock and supplier balance do not change.
      const order: PurchaseOrder = {
        id: uuidv4(), poNumber, supplierId: supplier.id, supplierName: supplier.name,
        items: items.map((i) => ({ ...i, received: 0 })), status: 'ordered', total,
        note: purchaseNote.trim() || undefined, expectedDate: expectedDate || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined, paymentTerms: paymentTerms.trim() || undefined,
        authorizedBy: user.name, createdAt: now, synced: false,
      }
      await db.transaction('rw', db.purchases, db.outbox, async () => {
        await db.purchases.add(order)
        await db.outbox.add({ id: uuidv4(), type: 'purchase', payload: order, createdAt: now, retries: 0 })
      })
      setShowPurchaseForm(false)
      setDocPo(order) // show the printable order straight away
      return
    }

    const po: PurchaseOrder = {
      id: uuidv4(),
      poNumber,
      authorizedBy: user.name,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: items.map((i) => ({ ...i, received: i.quantity })),
      status: 'received',
      total,
      note: purchaseNote.trim() || undefined,
      createdAt: now,
      receivedAt: now,
      synced: false,
    }

    await db.transaction('rw', db.purchases, db.products, db.stockMovements, db.suppliers, db.outbox, async () => {
      await db.purchases.add(po)
      for (const item of items) {
        const product = await db.products.get(item.productId)
        if (!product) continue
        const previousStock = product.stock
        const newStock = previousStock + item.quantity
        await db.products.update(item.productId, { stock: newStock, cost: item.cost, updatedAt: now })
        await db.stockMovements.add({
          id: uuidv4(),
          productId: item.productId,
          productName: item.name,
          type: 'purchase',
          quantity: item.quantity,
          previousStock,
          newStock,
          referenceId: po.id,
          userId: user.id,
          createdAt: now,
          synced: false,
        })
      }
      await db.outbox.add({ id: uuidv4(), type: 'purchase', payload: po, createdAt: now, retries: 0 })
      // Increase amount we owe the supplier
      const beforeBal = supplier.balance || 0
      await db.suppliers.update(supplier.id, { balance: beforeBal + total, updatedAt: now })
      await db.outbox.add({
        id: uuidv4(),
        type: 'supplier_upsert',
        payload: { ...supplier, balance: beforeBal + total, updatedAt: now },
        createdAt: now,
        retries: 0,
      })
    })
    setShowPurchaseForm(false)
  }


  const openDetail = (s: Supplier) => {
    setDetailSupplier(s)
    setPayAmount('')
    setShowDetail(true)
  }

  const paySupplier = async () => {
    if (!detailSupplier) return
    const amt = parseFloat(payAmount)
    if (!(amt > 0)) return
    const before = detailSupplier.balance || 0
    const applied = Math.min(amt, Math.max(0, before))
    if (applied <= 0) return
    const now = new Date().toISOString()
    await db.suppliers.update(detailSupplier.id, { balance: before - applied, updatedAt: now })
    await db.outbox.add({
      id: uuidv4(),
      type: 'supplier_upsert',
      payload: { ...detailSupplier, balance: before - applied, updatedAt: now },
      createdAt: now,
      retries: 0,
    })
    setDetailSupplier({ ...detailSupplier, balance: before - applied, updatedAt: now })
    setPayAmount('')
  }

  const purchaseList = (purchases || []).filter(
    (p) => poStatusFilter === 'all' || p.status === poStatusFilter,
  )
  const allPurchases = purchases || []

  return (
    <Screen
      title="Suppliers"
      subtitle={`${fmtMoney(totalPayable)} payable`}
      action={
        <div className="flex gap-2">
          <button type="button" onClick={() => openPurchase('order')} className="press h-9 px-3 rounded-full bg-ink text-white text-[13px] font-semibold flex items-center gap-1">
            <PackagePlus size={15} /> PO
          </button>
          <button type="button" onClick={openCreateSupplier} className="press h-9 px-3 rounded-full bg-primary text-white text-[13px] font-semibold flex items-center gap-1">
            <Plus size={15} /> Add
          </button>
        </div>
      }
    >
      <div className="space-y-4 md:max-w-2xl pb-6">
        <div className="flex gap-2 p-1 rounded-full bg-black/[0.05] w-fit">
          {(['suppliers', 'purchases'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`press h-9 px-4 rounded-full text-[13px] font-semibold capitalize ${
                tab === id ? 'bg-white text-ink shadow-card' : 'text-ink-secondary'
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        {tab === 'suppliers' && (
          <>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input className="field w-full !pl-10" placeholder="Search suppliers…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {loading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-[18px] bg-white shadow-card skeleton" />
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="rounded-[22px] bg-white shadow-card px-6 py-12 text-center">
                <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#FFF4E5] text-warning flex items-center justify-center">
                  <Truck size={26} />
                </div>
                <p className="text-[16px] font-semibold">No suppliers</p>
                <p className="text-[14px] text-ink-secondary mt-1 mb-4">Add suppliers before recording purchases.</p>
                <button type="button" onClick={openCreateSupplier} className="press h-11 px-5 rounded-[14px] bg-primary text-white font-semibold">
                  Add supplier
                </button>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
                {filtered.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openDetail(s)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${i < filtered.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <span className="h-11 w-11 rounded-[12px] bg-surface-secondary flex items-center justify-center shrink-0">
                      <Truck size={18} className="text-ink-muted" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold truncate">{s.name}</span>
                      <span className="block text-[13px] text-ink-secondary truncate">{s.phone || s.email || 'No contact'}</span>
                    </span>
                    {s.balance !== 0 && (
                      <span className="text-[13px] font-semibold tabular-nums text-ink-secondary">{fmtMoney(s.balance)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'purchases' && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {([
                ['all', 'All'],
                ['ordered', 'Ordered'],
                ['partial', 'Partial'],
                ['received', 'Received'],
                ['cancelled', 'Cancelled'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPoStatusFilter(id)}
                  className={`press shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold ${
                    poStatusFilter === id ? 'bg-primary text-white' : 'bg-black/[0.06] text-ink-secondary'
                  }`}
                >
                  {label}
                  {id !== 'all' ? ` (${allPurchases.filter((x) => x.status === id).length})` : ''}
                </button>
              ))}
            </div>
            {purchaseList.length === 0 ? (
              <div className="rounded-[22px] bg-white shadow-card px-6 py-12 text-center">
                <p className="text-[16px] font-semibold">No purchase orders yet</p>
                <p className="text-[14px] text-ink-secondary mt-1 mb-4">Create an order for your supplier, then receive the goods when they arrive.</p>
                <button type="button" onClick={() => openPurchase('order')} className="press h-11 px-5 rounded-[14px] bg-primary text-white font-semibold">
                  New purchase order
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
                {purchaseList.map((p, i) => (
                  <div key={p.id} className={`px-4 py-3.5 ${i < purchaseList.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold truncate">{p.supplierName}</p>
                        {p.poNumber && <p className="text-[12px] font-semibold text-primary">{p.poNumber} · {PO_STATUS_LABEL[p.status]}</p>}
                        <p className="text-[13px] text-ink-secondary">
                          {format(new Date(p.createdAt), 'dd MMM yyyy')} · {p.items.length} item{p.items.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <p className="text-[15px] font-semibold tabular-nums shrink-0">{fmtMoney(p.total)}</p>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => setDocPo(p)} className="press h-9 px-3 rounded-full bg-black/[0.06] text-[13px] font-semibold flex items-center gap-1.5"><Printer size={14} /> Print</button>
                      {(p.status === 'ordered' || p.status === 'partial') && (
                        <button type="button" onClick={() => void cancelPo(p)} className="press h-9 px-3 rounded-full bg-black/[0.06] text-[13px] font-semibold">Cancel</button>
                      )}
                      {(p.status === 'ordered' || p.status === 'partial') && (
                        <button type="button" onClick={() => openReceive(p)} className="press h-9 px-3 rounded-full bg-primary text-white text-[13px] font-semibold flex items-center gap-1.5"><PackageCheck size={14} /> Receive</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet
        open={showSupplierForm}
        onClose={() => setShowSupplierForm(false)}
        title={editing ? 'Edit supplier' : 'New supplier'}
        footer={
          <div className="space-y-2">
            <button type="button" onClick={() => void saveSupplier()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold">
              {editing ? 'Save changes' : 'Create supplier'}
            </button>
            {editing && (
              <button type="button" onClick={() => void handleDeleteSupplier()} className="press w-full h-11 rounded-[14px] text-danger font-semibold bg-red-50 flex items-center justify-center gap-2">
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3.5">
          {(['name', 'phone', 'email', 'address', 'notes'] as const).map((key) => (
            <div key={key}>
              <label className="auth-label capitalize">{key}</label>
              <input className="field w-full" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={showPurchaseForm}
        onClose={() => setShowPurchaseForm(false)}
        title={purchaseMode === 'order' ? 'New purchase order' : 'Receive stock (GRN)'}
        footer={
          <button type="button" onClick={() => void savePurchase()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold">
            {purchaseMode === 'order' ? 'Create order' : 'Receive & update stock'}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="auth-label">Supplier</label>
            <select className="field w-full" value={purchaseSupplierId} onChange={(e) => setPurchaseSupplierId(e.target.value)}>
              <option value="">Select…</option>
              {(suppliers || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {purchaseItems.map((line, idx) => (
            <div key={idx} className="rounded-[16px] bg-surface-secondary p-3 space-y-2">
              <select className="field w-full !bg-white" value={line.productId} onChange={(e) => updatePurchaseLine(idx, 'productId', e.target.value)}>
                <option value="">Product…</option>
                {(products || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input className="field flex-1 !bg-white" inputMode="numeric" placeholder="Qty" value={line.quantity} onChange={(e) => updatePurchaseLine(idx, 'quantity', e.target.value)} />
                <input className="field flex-1 !bg-white" inputMode="decimal" placeholder="Cost" value={line.cost} onChange={(e) => updatePurchaseLine(idx, 'cost', e.target.value)} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPurchaseItems([...purchaseItems, { productId: '', name: '', quantity: '1', cost: '' }])}
            className="text-[14px] font-semibold text-primary"
          >
            + Add line
          </button>
          {purchaseMode === 'order' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="auth-label">Delivery date</label>
                  <input type="date" className="field w-full" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
                </div>
                <div>
                  <label className="auth-label">Payment terms</label>
                  <input className="field w-full" placeholder="e.g. 30 days" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="auth-label">Delivery address</label>
                <input className="field w-full" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="auth-label">Note</label>
            <input className="field w-full" value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} />
          </div>
        </div>
      </Sheet>
      <DocumentModal open={!!docPo} onClose={() => setDocPo(null)} title={docPo?.poNumber || 'Purchase order'} doc={docPo ? poDoc(docPo) : null} />

      <Sheet
        open={!!receivePo}
        onClose={() => setReceivePo(null)}
        title={`Receive ${receivePo?.poNumber ?? 'order'}`}
        footer={
          <button type="button" onClick={() => void confirmReceive()} className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold">
            Confirm received & update stock
          </button>
        }
      >
        <div className="space-y-3">
          <p className="text-[14px] text-ink-secondary">Enter what actually arrived. You can receive the rest later.</p>
          {receivePo?.items.map((i) => (
            <div key={i.productId} className="rounded-[16px] bg-surface-secondary p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold truncate">{i.name}</p>
                <p className="text-[12px] text-ink-secondary">Ordered {i.quantity} · received {i.received ?? 0} · waiting {remainingQty(i)}</p>
              </div>
              <input
                type="number" inputMode="decimal" min={0} max={remainingQty(i)} disabled={remainingQty(i) === 0}
                className="field !w-24 text-right tabular-nums !bg-white"
                value={receiveQty[i.productId] ?? ''}
                onChange={(e) => setReceiveQty((q) => ({ ...q, [i.productId]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={showDetail && !!detailSupplier}
        onClose={() => setShowDetail(false)}
        title={detailSupplier?.name || 'Supplier'}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (detailSupplier) openEditSupplier(detailSupplier)
                setShowDetail(false)
              }}
              className="press flex-1 h-12 rounded-[14px] bg-black/[0.06] font-semibold"
            >
              Edit
            </button>
            {detailSupplier && (detailSupplier.balance || 0) > 0 && (
              <button type="button" onClick={() => void paySupplier()} className="press flex-1 h-12 rounded-[14px] bg-primary text-white font-semibold">
                Pay
              </button>
            )}
          </div>
        }
      >
        {detailSupplier && (
          <div className="space-y-4">
            <div className="rounded-[16px] bg-surface-secondary p-4 space-y-2 text-[14px]">
              {detailSupplier.phone && (
                <div className="flex justify-between"><span className="text-ink-secondary">Phone</span><span className="font-medium">{detailSupplier.phone}</span></div>
              )}
              {detailSupplier.email && (
                <div className="flex justify-between"><span className="text-ink-secondary">Email</span><span className="font-medium truncate ml-4">{detailSupplier.email}</span></div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold">Balance payable</span>
                <span className={`font-bold tabular-nums ${(detailSupplier.balance || 0) > 0 ? 'text-warning' : 'text-success'}`}>
                  {fmtMoney(detailSupplier.balance || 0)}
                </span>
              </div>
            </div>
            {(detailSupplier.balance || 0) > 0 && (
              <div className="rounded-[16px] bg-amber-50 p-4">
                <p className="text-[13px] font-semibold text-warning mb-2">Record payment to supplier</p>
                <div className="flex gap-2">
                  <input className="field flex-1 !bg-white" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount paid" />
                  <button type="button" onClick={() => setPayAmount(String(detailSupplier.balance))} className="press h-[46px] px-3 rounded-[14px] bg-white text-[13px] font-semibold">Full</button>
                </div>
              </div>
            )}
            <div>
              <p className="text-[13px] font-semibold text-ink-secondary mb-2">Purchases</p>
              {(purchaseList.filter((p) => p.supplierId === detailSupplier.id)).length === 0 ? (
                <p className="text-[14px] text-ink-muted py-3">No purchases from this supplier yet.</p>
              ) : (
                <div className="rounded-[16px] border border-border divide-y divide-border overflow-hidden">
                  {purchaseList.filter((p) => p.supplierId === detailSupplier.id).slice(0, 20).map((p) => (
                    <div key={p.id} className="px-3 py-3 flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold">{format(new Date(p.createdAt), 'dd MMM yyyy')}</p>
                        <p className="text-[12px] text-ink-muted">{p.items.length} items</p>
                      </div>
                      <p className="text-[14px] font-semibold tabular-nums">{fmtMoney(p.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>

    </Screen>
  )
}
