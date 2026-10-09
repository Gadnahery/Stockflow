import { useMemo } from 'react'
import type { Permission } from '../types'

export function usePermission() {
  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('currentUser') || '{}')
    } catch {
      return { permissions: [] as Permission[] }
    }
  }, [])

  const can = (permission: Permission) => {
    if (!user?.permissions) return false
    if (user.role === 'owner') return true
    return user.permissions.includes(permission)
  }

  return { user, can }
}
