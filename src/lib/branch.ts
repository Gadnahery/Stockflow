/** Active branch for this device / session */

import { getBranchId, setBranchId } from './supabase'

const PICK_KEY = 'sf_branch_picked'

export function getActiveBranchId(): string | null {
  return getBranchId()
}

export function setActiveBranchId(id: string) {
  setBranchId(id)
  try {
    localStorage.setItem(PICK_KEY, '1')
  } catch { /* ignore */ }
}

export function clearBranchPickFlag() {
  try {
    localStorage.removeItem(PICK_KEY)
  } catch { /* ignore */ }
}

/** True if user already chose a branch this session/device */
export function hasPickedBranch(): boolean {
  try {
    return localStorage.getItem(PICK_KEY) === '1' && Boolean(getBranchId())
  } catch {
    return Boolean(getBranchId())
  }
}

export function needsBranchPicker(branchCount: number, memberBranchIds: string[] | null | undefined): boolean {
  if (branchCount <= 1) return false
  // Staff limited to one branch — auto-select, no picker
  if (memberBranchIds && memberBranchIds.length === 1) {
    setActiveBranchId(memberBranchIds[0])
    return false
  }
  if (hasPickedBranch()) return false
  return true
}
