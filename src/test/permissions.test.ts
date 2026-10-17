import { describe, expect, it } from 'vitest'
import {
  PERMISSION_CATALOGUE,
  PERMISSION_KEYS,
  ROLE_PRESETS,
  hasPermission,
  canApproveOverrides,
  isOwnerRole,
} from '../lib/permissions'

describe('permissions catalogue', () => {
  it('has unique keys matching Permission union coverage', () => {
    const keys = PERMISSION_CATALOGUE.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('VOID_SALE')
    expect(keys).toContain('REFUND_SALE')
    expect(keys).toContain('APPROVE_OVERRIDE')
    expect(PERMISSION_KEYS.length).toBe(keys.length)
  })

  it('every catalogue entry has EN and SW labels', () => {
    for (const p of PERMISSION_CATALOGUE) {
      expect(p.labelEn.length).toBeGreaterThan(2)
      expect(p.labelSw.length).toBeGreaterThan(2)
      expect(p.descriptionEn.length).toBeGreaterThan(2)
      expect(p.descriptionSw.length).toBeGreaterThan(2)
    }
  })

  it('owner role always has every permission', () => {
    for (const key of PERMISSION_KEYS) {
      expect(hasPermission('business_owner', [], key)).toBe(true)
      expect(hasPermission('owner', null, key)).toBe(true)
    }
  })

  it('cashier cannot void or refund without those flags', () => {
    const perms = ROLE_PRESETS.cashier
    expect(hasPermission('cashier', perms, 'CREATE_SALE')).toBe(true)
    expect(hasPermission('cashier', perms, 'VOID_SALE')).toBe(false)
    expect(hasPermission('cashier', perms, 'REFUND_SALE')).toBe(false)
    expect(canApproveOverrides('cashier', perms)).toBe(false)
  })

  it('manager can void, refund, and approve overrides', () => {
    const perms = ROLE_PRESETS.business_manager
    expect(hasPermission('business_manager', perms, 'VOID_SALE')).toBe(true)
    expect(hasPermission('business_manager', perms, 'REFUND_SALE')).toBe(true)
    expect(canApproveOverrides('business_manager', perms)).toBe(true)
  })

  it('isOwnerRole matches known owner roles', () => {
    expect(isOwnerRole('owner')).toBe(true)
    expect(isOwnerRole('business_owner')).toBe(true)
    expect(isOwnerRole('cashier')).toBe(false)
  })
})
