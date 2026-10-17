import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Receipt, Ban, ShoppingBag } from 'lucide-react'
import { format, isToday, isYesterday, startOfDay, subDays } from 'date-fns'
import { db } from '../lib/db'
import type { Sale } from '../types'
import ReceiptModal from '../components/ReceiptModal'
import Screen from '../components/ui/Screen'
import ManagerPinSheet from '../components/ManagerPinSheet'
import { DocumentModal } from '../components/PrintDocument'
import { saleToInvoiceDoc } from '../lib/invoice'
import type { PrintDocumentProps } from '../components/PrintDocument'
import { useI18n } from '../i18n/I18nContext'
import { usePosStore } from '../store/posStore'
import { usePermission } from '../hooks/usePermission'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { useUi } from '../store/uiStore'
import { fmtMoney } from '../lib/util'
import BranchFilter from '../components/BranchFilter'
import { matchBranch } from '../hooks/useBranches'

type Period = 'today' | '7d' | '30d' | 'all'
type StatusFilter = 'all' | 'completed' | 'voided' | 'refunded'

export default function SalesPage() {
  const { t } = useI18n()
  const [selected, setSelected] = useState<Sale | null>(null)
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<Period>('7d')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const voidSale = usePosStore((s) => s.voidSale)
  const refundSale = usePosStore((s) => s.refundSale)
  const { can } = usePermission()
  const confirm = useConfirm()
  const toast = useUi((s) => s.toast)

  const sales = useLiveQuery(
    () => db.sales.orderBy('createdAt').reverse().limit(300).toArray(),
    [],
  )

  const loading = sales === undefined

  const filtered = useMemo(() => {
    if (!sales) return []
    const q = query.trim().toLowerCase()
    const now = new Date()
    let from: Date | null = null
    if (period === 'today') from = startOfDay(now)
    else if (period === '7d') from = subDays(now, 7)
    else if (period === '30d') from = subDays(now, 30)

    return sales.filter((s) => {
      if (status !== 'all' && s.status !== status) return false
      if (from && new Date(s.createdAt) < from) return false
      if (!matchBranch(s.branchId, branchFilter)) return false
      if (!q) return true
      return (
        s.receiptNumber.toLowerCase().includes(q) ||
        (s.cashierName || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q)
      )
    })
  }, [sales, query, period, status, branchFilter])

  const totals = useMemo(() => {
    const completed = filtered.filter((s) => s.status === 'completed')
    const revenue = completed.reduce((a, s) => a + s.total, 0)
    return { count: completed.length, revenue }
  }, [filtered])

  const [invoiceDoc, setInvoiceDoc] = useState<PrintDocumentProps | null>(null)
  const [approveAction, setApproveAction] = useState<null | { type: 'void' | 'refund'; sale: Sale }>(null)

  const openInvoice = async (sale: Sale) => {
    try {
      const doc = await saleToInvoiceDoc(sale, { title: 'Invoice' })
      setInvoiceDoc(doc)
    } catch (e) {
      toast((e as Error).message || 'Could not build invoice', 'error')
    }
  }

  const runVoid = async (
    sale: Sale,
    opts?: { approvedById?: string; approvedByName?: string },
  ) => {
    try {
      await voidSale(sale.id, {
        reason: `Receipt ${sale.receiptNumber}`,
        approvedById: opts?.approvedById,
        approvedByName: opts?.approvedByName,
      })
      toast(
        opts?.approvedByName
          ? `Sale voided (approved by ${opts.approvedByName})`
          : 'Sale voided',
        'success',
      )
      if (selected?.id === sale.id) setSelected(null)
    } catch (e) {
      toast((e as Error).message || 'Could not void sale', 'error')
    }
  }

  const runRefund = async (
    sale: Sale,
    opts?: { approvedById?: string; approvedByName?: string },
  ) => {
    try {
      await refundSale(sale.id, {
        reason: `Receipt ${sale.receiptNumber}`,
        restock: true,
        refundAmount: sale.total,
        approvedById: opts?.approvedById,
        approvedByName: opts?.approvedByName,
      })
      toast(
        opts?.approvedByName
          ? `Sale refunded (approved by ${opts.approvedByName})`
          : 'Sale refunded — stock restored',
        'success',
      )
      if (selected?.id === sale.id) setSelected(null)
    } catch (e) {
      toast((e as Error).message || 'Could not refund sale', 'error')
    }
  }

  const handleVoid = async (sale: Sale) => {
    if (sale.status !== 'completed') return
    if (!can('VOID_SALE')) {
      const ok = await confirm({
        title: 'Manager approval required',
        message: `You cannot void sales alone. A manager must enter the device PIN to void receipt ${sale.receiptNumber}.`,
        confirmLabel: 'Request approval',
        tone: 'danger',
      })
      if (!ok) return
      setApproveAction({ type: 'void', sale })
      return
    }
    const ok = await confirm({
      title: 'Void this sale?',
      message: `Receipt ${sale.receiptNumber} · ${fmtMoney(sale.total)}. Stock will be restored.`,
      confirmLabel: 'Void',
      tone: 'danger',
    })
    if (!ok) return
    await runVoid(sale)
  }

  const handleRefund = async (sale: Sale) => {
    if (sale.status !== 'completed') return
    if (!can('REFUND_SALE') && !can('VOID_SALE')) {
      const ok = await confirm({
        title: 'Manager approval required',
        message: `You cannot refund sales alone. A manager must enter the device PIN to refund receipt ${sale.receiptNumber}.`,
        confirmLabel: 'Request approval',
        tone: 'danger',
      })
      if (!ok) return
      setApproveAction({ type: 'refund', sale })
      return
    }
    const ok = await confirm({
      title: 'Refund this sale?',
      message: `Restock items and mark receipt ${sale.receiptNumber} as refunded. Total ${sale.total.toLocaleString()} TZS.`,
      confirmLabel: 'Refund',
      tone: 'danger',
    })
    if (!ok) return
    await runRefund(sale)
  }

  const dateLabel = (iso: string) => {
    const d = new Date(iso)
    if (isToday(d)) return `Today · ${format(d, 'HH:mm')}`
    if (isYesterday(d)) return `Yesterday · ${format(d, 'HH:mm')}`
    return format(d, 'dd MMM yyyy · HH:mm')
  }

  const statusChip = (st: Sale['status']) => {
    const map: Record<string, string> = {
      completed: 'bg-emerald-50 text-success',
      voided: 'bg-red-50 text-danger',
      refunded: 'bg-amber-50 text-warning',
      held: 'bg-surface-secondary text-ink-muted',
    }
    return map[st] || 'bg-surface-secondary text-ink-muted'
  }

  return (
    <Screen
      title={t("sales.title")}
      subtitle={
        loading
          ? 'Loading…'
          : `${totals.count} sale${totals.count === 1 ? '' : 's'} · ${fmtMoney(totals.revenue)}`
      }
    >
      <div className="space-y-4 md:max-w-3xl pb-6">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="field w-full !pl-10"
            placeholder="Search receipt, cashier, customer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Period chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {(
            [
              ['today', 'Today'],
              ['7d', '7 days'],
              ['30d', '30 days'],
              ['all', 'All'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              className={`press shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold ${
                period === id ? 'bg-primary text-white' : 'bg-white text-ink-secondary shadow-card'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <BranchFilter value={branchFilter} onChange={setBranchFilter} />

        {/* Status chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(
            [
              ['all', 'All status'],
              ['completed', 'Completed'],
              ['voided', 'Voided'],
              ['refunded', 'Refunded'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              className={`press shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold ${
                status === id ? 'bg-ink text-white' : 'bg-black/[0.05] text-ink-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[76px] rounded-[18px] bg-white shadow-card skeleton" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-12 text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#E8F0FE] text-primary flex items-center justify-center">
              <ShoppingBag size={26} />
            </div>
            <p className="text-[16px] font-semibold text-ink">No sales found</p>
            <p className="text-[14px] text-ink-secondary mt-1">
              {query || period !== 'all' || status !== 'all'
                ? 'Try a different filter or search.'
                : 'Completed sales will show up here.'}
            </p>
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
            {filtered.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  i < filtered.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink truncate">{s.receiptNumber}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${statusChip(s.status)}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-secondary mt-0.5 truncate">
                    {dateLabel(s.createdAt)}
                    {s.cashierName ? ` · ${s.cashierName}` : ''}
                    {s.customerName ? ` · ${s.customerName}` : ''}
                  </p>
                </button>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-semibold tabular-nums text-ink">{fmtMoney(s.total)}</p>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setSelected(s)}
                      className="press h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"
                      aria-label="View receipt"
                    >
                      <Receipt size={15} />
                    </button>
                    {true && (
                      <button
                        type="button"
                        onClick={() => void openInvoice(s)}
                        className="press text-[12px] font-semibold text-primary px-2 py-1"
                      >
                        A4 invoice
                      </button>
                    )}
                    {s.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => void handleRefund(s)}
                        className="press h-8 px-2.5 rounded-full bg-amber-50 text-warning text-[11px] font-bold"
                        aria-label="Refund sale"
                      >
                        Refund
                      </button>
                    )}
                    {s.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => void handleVoid(s)}
                        className="press h-8 w-8 rounded-full bg-red-50 text-danger flex items-center justify-center"
                        aria-label="Void sale"
                      >
                        <Ban size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <ReceiptModal sale={selected} onClose={() => setSelected(null)} />}
    </Screen>
      <DocumentModal
        open={Boolean(invoiceDoc)}
        onClose={() => setInvoiceDoc(null)}
        title="Invoice"
        doc={invoiceDoc}
      />
      <ManagerPinSheet
        open={Boolean(approveAction)}
        onClose={() => setApproveAction(null)}
        title={approveAction?.type === 'void' ? 'Approve void' : 'Approve refund'}
        subtitle={
          approveAction
            ? `Receipt ${approveAction.sale.receiptNumber} · ${fmtMoney(approveAction.sale.total)}`
            : undefined
        }
        onApproved={(approver) => {
          const action = approveAction
          setApproveAction(null)
          if (!action) return
          if (action.type === 'void') void runVoid(action.sale, { approvedById: approver.id, approvedByName: approver.name })
          else void runRefund(action.sale, { approvedById: approver.id, approvedByName: approver.name })
        }}
      />

  )
}
