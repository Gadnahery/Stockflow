export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
export const fmtMoney = (n: number) => `${fmt(n)} TZS`

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
}

/** EAN-13 with an in-store prefix (20x) and valid check digit — for items without a printed barcode. */
export function generateBarcode(): string {
  const body = '200' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  const sum = body.split('').reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
  return body + ((10 - (sum % 10)) % 10)
}

export function makeSku(name: string, category?: string): string {
  const base = (category || name).replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'SKU'
  return `${base}-${Math.floor(100 + Math.random() * 900)}`
}

const TINTS = [
  ['#E0EDFF', '#007AFF'], ['#E3F7E8', '#1E9E54'], ['#FFF0DC', '#C96A00'],
  ['#F1E6FF', '#7B3FE4'], ['#FFE5E8', '#E0333C'], ['#DFF6F6', '#0E8A8A'],
]
export function tintFor(name: string): [string, string] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length] as [string, string]
}
