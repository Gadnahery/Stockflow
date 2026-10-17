import type { CartItem, Product } from '../types'

/** Base units deducted/restocked for a cart line */
export function stockUnitsForLine(item: Pick<CartItem, 'quantity' | 'stockUnits' | 'sellAs'>): number {
  if (item.stockUnits != null && item.stockUnits > 0) return item.stockUnits
  return item.quantity
}

/** Cost for one sold unit or pack line (for profit). Pack uses packCost if set, else cost × packQty. */
export function lineCost(product: Product, item: Pick<CartItem, 'quantity' | 'sellAs' | 'stockUnits'>): number {
  const units = stockUnitsForLine(item)
  if (item.sellAs === 'pack' && product.packCost != null && (product.packQty || 0) > 0) {
    const packs = item.quantity
    return packs * product.packCost
  }
  return units * (product.cost || 0)
}

/** Derive per-piece cost from pack buy price */
export function unitCostFromPack(packCost: number, packQty: number): number {
  if (!packQty || packQty <= 0) return 0
  return Math.round((packCost / packQty) * 100) / 100
}

/** Savings if customer buys pack vs same number of singles */
export function packSavings(packPrice: number, unitPrice: number, packQty: number): number {
  if (!packQty || packQty <= 0) return 0
  return Math.round(packQty * unitPrice - packPrice)
}
