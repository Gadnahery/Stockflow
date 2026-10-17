import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../lib/db'
import { usePosStore } from '../store/posStore'
import { lineCost, packSavings, stockUnitsForLine, unitCostFromPack } from '../lib/pack'
import type { Product } from '../types'
import { v4 as uuidv4 } from 'uuid'

const egg: Product = {
  id: uuidv4(),
  name: 'Eggs',
  sku: 'EGG-1',
  price: 350,
  cost: 267,
  stock: 90,
  unit: 'pc',
  packQty: 30,
  packName: 'tray',
  packPrice: 9500,
  packCost: 8000,
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('jumla / reja helpers', () => {
  it('derives unit cost from pack cost', () => {
    expect(unitCostFromPack(8000, 30)).toBeCloseTo(266.67, 1)
  })

  it('shows tray savings vs 30 singles', () => {
    expect(packSavings(9500, 350, 30)).toBe(1000) // 10500 - 9500
  })

  it('stock units for pack line', () => {
    expect(stockUnitsForLine({ quantity: 2, sellAs: 'pack', stockUnits: 60 })).toBe(60)
    expect(stockUnitsForLine({ quantity: 3, sellAs: 'unit' })).toBe(3)
  })

  it('line cost uses packCost for pack sales', () => {
    const cost = lineCost(egg, { quantity: 1, sellAs: 'pack', stockUnits: 30 })
    expect(cost).toBe(8000)
    const unit = lineCost(egg, { quantity: 2, sellAs: 'unit', stockUnits: 2 })
    expect(unit).toBe(534)
  })
})

describe('cart pack + single lines', () => {
  beforeEach(async () => {
    await db.products.clear()
    await db.products.put(egg)
    usePosStore.setState({ cart: [], selectedCustomerId: null, selectedCustomerName: null })
  })

  it('keeps pack and unit as separate lines', () => {
    const { addToCart } = usePosStore.getState()
    addToCart(egg, 1, 'pack')
    addToCart(egg, 2, 'unit')
    const cart = usePosStore.getState().cart
    expect(cart).toHaveLength(2)
    const pack = cart.find((c) => c.sellAs === 'pack')
    const unit = cart.find((c) => c.sellAs === 'unit')
    expect(pack?.quantity).toBe(1)
    expect(pack?.stockUnits).toBe(30)
    expect(pack?.price).toBe(9500)
    expect(unit?.quantity).toBe(2)
    expect(unit?.stockUnits).toBe(2)
    expect(unit?.price).toBe(350)
  })

  it('qty change on pack only affects pack line', () => {
    const { addToCart, updateQuantity } = usePosStore.getState()
    addToCart(egg, 1, 'pack')
    addToCart(egg, 1, 'unit')
    updateQuantity(egg.id, 2, 'pack')
    const cart = usePosStore.getState().cart
    expect(cart.find((c) => c.sellAs === 'pack')?.quantity).toBe(2)
    expect(cart.find((c) => c.sellAs === 'pack')?.stockUnits).toBe(60)
    expect(cart.find((c) => c.sellAs === 'unit')?.quantity).toBe(1)
  })

  it('remove pack leaves unit line', () => {
    const { addToCart, removeFromCart } = usePosStore.getState()
    addToCart(egg, 1, 'pack')
    addToCart(egg, 1, 'unit')
    removeFromCart(egg.id, 'pack')
    const cart = usePosStore.getState().cart
    expect(cart).toHaveLength(1)
    expect(cart[0].sellAs).toBe('unit')
  })

  it('hold/resume keeps sellAs and stockUnits', () => {
    const store = usePosStore.getState()
    store.addToCart(egg, 1, 'pack')
    store.addToCart(egg, 3, 'unit')
    expect(store.holdCart()).toBe(true)
    const held = usePosStore.getState().held
    expect(held).toHaveLength(1)
    expect(held[0].items.some((i) => i.sellAs === 'pack' && i.stockUnits === 30)).toBe(true)
    usePosStore.getState().resumeHeld(held[0].id)
    const cart = usePosStore.getState().cart
    expect(cart.find((c) => c.sellAs === 'pack')?.stockUnits).toBe(30)
    expect(cart.find((c) => c.sellAs === 'unit')?.quantity).toBe(3)
  })
})
