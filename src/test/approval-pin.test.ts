import { describe, expect, it, beforeEach } from 'vitest'
import {
  saveApprovalPin,
  matchApprovalPin,
  hasAnyApprovalPin,
  simpleHash,
  listApprovalPins,
} from '../lib/approvalPin'

describe('approval PIN (separate from device unlock)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('rejects device-style PIN when only manager approval PIN is set', () => {
    saveApprovalPin({ memberId: 'owner1', name: 'Owner', pin: '9999' })
    // Device unlock PIN is different
    localStorage.setItem('sf_device_pin', simpleHash('1234'))
    expect(matchApprovalPin('1234')).toBeNull()
    expect(matchApprovalPin('9999')?.memberId).toBe('owner1')
    expect(matchApprovalPin('9999')?.name).toBe('Owner')
  })

  it('blocks when no approval PIN configured', () => {
    expect(hasAnyApprovalPin()).toBe(false)
    expect(matchApprovalPin('1234')).toBeNull()
  })

  it('matches the correct approver among several', () => {
    saveApprovalPin({ memberId: 'm1', name: 'Manager A', pin: '1111' })
    saveApprovalPin({ memberId: 'm2', name: 'Manager B', pin: '2222' })
    expect(listApprovalPins()).toHaveLength(2)
    expect(matchApprovalPin('2222')?.name).toBe('Manager B')
  })
})
