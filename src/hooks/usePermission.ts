import { useAuth } from '../contexts/AuthContext'
import type { Permission } from '../types'

/**
 * Permission checks from the authenticated business member.
 * Falls back to empty permissions when signed out.
 */
export function usePermission() {
  const { member, can, user } = useAuth()

  return {
    user: member
      ? {
          id: member.user_id,
          name: member.display_name || user?.email || 'User',
          role: member.role,
          permissions: member.permissions || [],
          active: member.status === 'active',
        }
      : null,
    can: (permission: Permission) => can(permission),
  }
}
