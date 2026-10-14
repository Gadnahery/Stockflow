import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PinLockScreen from './PinLockScreen'
import BranchPicker from './BranchPicker'
import { needsBranchPicker } from '../lib/branch'
import { supabase, getBusinessId } from '../lib/supabase'
import { useEffect, useState } from 'react'

function FullScreenSpinner() {
  return (
    <div className="min-h-full flex items-center justify-center bg-[var(--canvas)]">
      <div className="h-10 w-10 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
    </div>
  )
}

/**
 * Protects app routes. Order of checks (stable, no flicker):
 * 1. loading → spinner
 * 2. no session → /login
 * 3. session but no membership → /onboarding (except when already there)
 * 4. pin locked → PIN pad only
 * 5. otherwise children
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading, pinLocked, member } = useAuth()
  const location = useLocation()
  const path = location.pathname
  const [branchReady, setBranchReady] = useState(false)
  const [branchCount, setBranchCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!member || !supabase) {
        if (!cancelled) setBranchReady(true)
        return
      }
      const bizId = getBusinessId() || member.business_id
      if (!bizId) {
        if (!cancelled) setBranchReady(true)
        return
      }
      const { count } = await supabase
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', bizId)
      const n = count || 0
      if (!cancelled) {
        setBranchCount(n)
        if (!needsBranchPicker(n, member.branch_ids)) setBranchReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [member?.business_id, member?.branch_ids, member])

  if (loading) return <FullScreenSpinner />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: path }} />
  }

  const onOnboarding = path.startsWith('/onboarding')
  const onAccept = path.startsWith('/accept-invite')

  if (!member && !onOnboarding && !onAccept) {
    return <Navigate to="/onboarding" replace />
  }

  if (pinLocked && member && !onOnboarding) {
    return <PinLockScreen />
  }

  if (member && !onOnboarding && !branchReady && needsBranchPicker(branchCount, member.branch_ids)) {
    return <BranchPicker onDone={() => setBranchReady(true)} />
  }

  return <>{children}</>
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: import('../types').Permission
  children: React.ReactNode
}) {
  const { can, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!can(permission)) {
    return (
      <div className="p-6 text-center text-[#5F5F66]">
        You do not have permission to view this page.
      </div>
    )
  }
  return <>{children}</>
}
