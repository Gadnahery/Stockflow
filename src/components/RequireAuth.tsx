import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PinLockScreen from './PinLockScreen'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading, pinLocked, member } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#F2F2F7]">
        <div className="h-10 w-10 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Authenticated but no business yet → onboarding
  if (!member && !location.pathname.startsWith('/onboarding') && !location.pathname.startsWith('/accept-invite')) {
    return <Navigate to="/onboarding" replace />
  }

  if (pinLocked) {
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
  if (loading) return null
  if (!can(permission)) {
    return (
      <div className="p-6 text-center text-[#5F5F66]">
        You do not have permission to view this page.
      </div>
    )
  }
  return <>{children}</>
}
