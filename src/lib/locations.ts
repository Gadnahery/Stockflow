/**
 * Shop (selling floor) vs Store (back room).
 * product.stock = shop quantity (POS sells from here)
 * product.storeStock = back-room quantity
 *
 * Design decision (audit §6): dual location is a flat pair of fields on each product,
 * not a separate warehouse table per branch. With multi-branch + isolated catalogues,
 * each branch already has its own product rows (and thus its own shop/store stock).
 * Growth/Pro "stores follow branches" is satisfied by branch count, not extra warehouse entities.
 */
import { db } from './db'
import { v4 as uuidv4 } from 'uuid'
import type { Product, StockMovement } from '../types'

export async function dualLocationEnabled(): Promise<boolean> {
  try {
    const s = await db.settings.get('main')
    return Boolean(s?.dualLocationStock)
  } catch {
    return false
  }
}

export function shopQty(p: Pick<Product, 'stock'>): number {
  return p.stock ?? 0
}

export function storeQty(p: Pick<Product, 'storeStock'>): number {
  return p.storeStock ?? 0
}

/**
 * Move quantity between store and shop for one product.
 * Creates a stock movement with type transfer.
 */
export async function transferStock(opts: {
  productId: string
  quantity: number
  direction: 'store_to_shop' | 'shop_to_store'
  userId?: string
  reason?: string
}): Promise<{ product: Product; movement: StockMovement }> {
  const qty = Math.max(0, Math.floor(opts.quantity * 1000) / 1000)
  if (qty <= 0) throw new Error('Enter a quantity to transfer')

  const product = await db.products.get(opts.productId)
  if (!product) throw new Error('Product not found')

  const shop = shopQty(product)
  const store = storeQty(product)
  const now = new Date().toISOString()

  let nextShop = shop
  let nextStore = store
  if (opts.direction === 'store_to_shop') {
    if (store < qty) throw new Error('Not enough stock in store')
    nextStore = store - qty
    nextShop = shop + qty
  } else {
    if (shop < qty) throw new Error('Not enough stock on shop floor')
    nextShop = shop - qty
    nextStore = store + qty
  }

  const movement: StockMovement = {
    id: uuidv4(),
    productId: product.id,
    productName: product.name,
    type: 'transfer',
    quantity: opts.direction === 'store_to_shop' ? qty : -qty,
    previousStock: shop,
    newStock: nextShop,
    reason:
      opts.reason ||
      (opts.direction === 'store_to_shop' ? 'Store → Shop' : 'Shop → Store'),
    userId: opts.userId,
    createdAt: now,
    synced: false,
  }

  await db.transaction('rw', [db.products, db.stockMovements], async () => {
    await db.products.update(product.id, {
      stock: nextShop,
      storeStock: nextStore,
      updatedAt: now,
    })
    await db.stockMovements.add(movement)
  })

  const updated = (await db.products.get(product.id)) as Product
  return { product: updated, movement }
}

export function locationLabel(shop: number, store: number, sw = false): string {
  if (sw) return `Duka ${shop} · Stoo ${store}`
  return `Shop ${shop} · Store ${store}`
}
