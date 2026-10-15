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
  const [activeId, setActiveId] = useState<string | null>(() => getBranchId())

  const reload = useCallback(async () => {
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase) {
      setBranches([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('business_id', bizId)
        .order('name')
      let list = (data as BranchRow[]) || []
      const unrestricted = ['owner', 'business_owner', 'platform_admin'].includes(String(member?.role))
      const allowed = member?.branch_ids
      if (!unrestricted && allowed && allowed.length > 0) {
        list = list.filter((b) => allowed.includes(b.id))
      }
      setBranches(list)
      const current = getBranchId()
      if (list.length && current && !list.some((b) => b.id === current)) {
        setActiveBranchId(list[0].id)
        setActiveId(list[0].id)
      } else if (list.length && !current) {
        setActiveBranchId(list[0].id)
        setActiveId(list[0].id)
      } else {
        setActiveId(getBranchId())
      }
    } catch {
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [member?.business_id, member?.branch_ids, member?.role])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onChange = () => setActiveId(getBranchId())
    window.addEventListener('sf-branch-change', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('sf-branch-change', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const active = branches.find((b) => b.id === activeId) || branches[0] || null

  const switchTo = async (id: string) => {
    // Tag sales/reports only — never wipe or hide the shared product catalogue
    setActiveBranchId(id)
    setActiveId(id)
    try {
      await db.settings.update('main', { branchId: id } as Record<string, unknown>)
    } catch {
      /* optional */
    }
    window.dispatchEvent(new Event('sf-branch-change'))
  }

  return { branches, loading, activeId, active, switchTo, reload }
}

/** Filter sales/expenses by branch — never use this on products */
export function matchBranch(
  rowBranchId: string | null | undefined,
  filterId: string | 'all',
): boolean {
  if (filterId === 'all' || !filterId) return true
  if (!rowBranchId) return true
  return rowBranchId === filterId
}
