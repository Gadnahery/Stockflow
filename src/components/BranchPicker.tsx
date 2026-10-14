import { useEffect, useState } from 'react'
import { Building2, Check } from 'lucide-react'
import { supabase, getBusinessId } from '../lib/supabase'
import { setActiveBranchId } from '../lib/branch'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/db'

type BranchRow = { id: string; name: string; code: string | null }

/** Shown after login when the business has more than one branch */
export default function BranchPicker({ onDone }: { onDone: () => void }) {
  const { member } = useAuth()
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const bizId = getBusinessId() || member?.business_id
      if (!bizId || !supabase) {
        setLoading(false)
        onDone()
        return
      }
      const { data } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('business_id', bizId)
        .order('name')
      let list = (data as BranchRow[]) || []
      // Staff may only see assigned branches
      const allowed = member?.branch_ids
      if (allowed && allowed.length > 0) {
        list = list.filter((b) => allowed.includes(b.id))
      }
      if (!cancelled) {
        setBranches(list)
        setLoading(false)
        if (list.length <= 1) {
          if (list[0]) setActiveBranchId(list[0].id)
          onDone()
        }
      }
    })()
    return () => { cancelled = true }
  }, [member?.business_id, member?.branch_ids, onDone])

  const pick = async (b: BranchRow) => {
    setBusy(b.id)
    setActiveBranchId(b.id)
    try {
      await db.settings.update('main', { branchId: b.id } as any)
    } catch { /* optional */ }
    onDone()
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[var(--canvas)]">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-5 py-10 bg-[var(--canvas)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
            <Building2 size={28} />
          </div>
          <h1 className="text-[22px] font-bold text-ink tracking-tight">Choose branch</h1>
          <p className="text-[14px] text-ink-secondary mt-1">
            Sales and stock for this device will use the branch you select.
          </p>
        </div>
        <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
          {branches.map((b, i) => (
            <button
              key={b.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void pick(b)}
              className={`press w-full flex items-center gap-3 px-4 py-4 text-left ${
                i < branches.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[14px]">
                {(b.code || b.name).slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] font-semibold text-ink truncate">{b.name}</span>
                {b.code && <span className="text-[12px] text-ink-muted">{b.code}</span>}
              </span>
              {busy === b.id ? (
                <span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <Check size={18} className="text-ink-muted" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
