import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PinLockScreen from './PinLockScreen'

function FullScreenSpinner() {
  return (
    <div className="min-h-full flex items-center justify-center bg-[#F2F2F7]">
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

  if (loading) return <FullScreenSpinner />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: path }} />
  }

  const onOnboarding = path.startsWith('/onboarding')
  const onAccept = path.startsWith('/accept-invite')

  if (!member && !onOnboarding && !onAccept) {
    return <Navigate to="/onboarding" replace />
  }

  // PIN lock only after membership is known (in-app)
  if (pinLocked && member && !onOnboarding) {
    return <PinLockScreen />
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
