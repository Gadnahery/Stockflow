import { useCallback, useEffect, useState } from 'react'
import { supabase, getBusinessId, getBranchId } from '../lib/supabase'
import { setActiveBranchId } from '../lib/branch'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/db'

export type BranchRow = { id: string; name: string; code: string | null }

export function useBranches() {
  const { member } = useAuth()
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const activeId = getBranchId()

  const reload = useCallback(async () => {
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase) {
      setBranches([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('business_id', bizId)
      .order('name')
    let list = (data as BranchRow[]) || []
    const allowed = member?.branch_ids
    if (allowed && allowed.length > 0) {
      list = list.filter((b) => allowed.includes(b.id))
    }
    setBranches(list)
    setLoading(false)
  }, [member?.business_id, member?.branch_ids])

  useEffect(() => {
    void reload()
  }, [reload])

  const active = branches.find((b) => b.id === activeId) || branches[0] || null

  const switchTo = async (id: string) => {
    setActiveBranchId(id)
    try {
      await db.settings.update('main', { branchId: id } as Record<string, unknown>)
    } catch { /* optional */ }
    // force re-render consumers
    window.dispatchEvent(new Event('sf-branch-change'))
  }

  return { branches, loading, activeId, active, switchTo, reload }
}

/** Filter list of sales/expenses by branch selection */
export function matchBranch(
  rowBranchId: string | null | undefined,
  filterId: string | 'all',
): boolean {
  if (filterId === 'all') return true
  if (!rowBranchId) return filterId === 'all' || !filterId
  return rowBranchId === filterId
}
