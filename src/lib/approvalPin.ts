/** Per-member approval PINs for void/refund override (NOT the device unlock PIN). */

const KEY = 'sf_approval_pins'

export type ApprovalPinEntry = {
  memberId: string
  name: string
  hash: string
  permissions?: string[]
}

export function simpleHash(pin: string): string {
  let h = 0
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) | 0
  return `local:${h}`
}

export function listApprovalPins(): ApprovalPinEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as ApprovalPinEntry[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveApprovalPin(entry: Omit<ApprovalPinEntry, 'hash'> & { pin: string }): void {
  const pins = listApprovalPins().filter((p) => p.memberId !== entry.memberId)
  pins.push({
    memberId: entry.memberId,
    name: entry.name,
    hash: simpleHash(entry.pin),
    permissions: entry.permissions,
  })
  localStorage.setItem(KEY, JSON.stringify(pins))
}

export function removeApprovalPin(memberId: string): void {
  const pins = listApprovalPins().filter((p) => p.memberId !== memberId)
  localStorage.setItem(KEY, JSON.stringify(pins))
}

/** Match entered PIN to an authorised approver. Returns null if none match. */
export function matchApprovalPin(pin: string): ApprovalPinEntry | null {
  const hash = simpleHash(pin)
  return listApprovalPins().find((p) => p.hash === hash) || null
}

export function hasAnyApprovalPin(): boolean {
  return listApprovalPins().length > 0
}
