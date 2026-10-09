export type UUID = string

export type Permission =
  | 'CREATE_SALE'
  | 'VOID_SALE'
  | 'REFUND_SALE'
  | 'CHANGE_PRICE'
  | 'APPLY_DISCOUNT'
  | 'ADJUST_STOCK'
  | 'VIEW_PROFIT'
  | 'EXPORT_DATA'
  | 'MANAGE_USERS'
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_SUPPLIERS'
  | 'VIEW_REPORTS'
  | 'MANAGE_SHIFTS'
  | 'MANAGE_SETTINGS'

export interface Product {
  id: UUID
  name: string
  sku: string
  barcode?: string
  price: number
  cost: number
  stock: number
  minStock?: number
  category?: string
  brand?: string
  unit?: string
  /** Compressed JPEG data URL (stored locally) */
  imageUrl?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  productId: UUID
  name: string
  sku: string
  imageUrl?: string
  price: number
  quantity: number
  discount: number
  lineTotal: number
}

export interface Payment {
  method: 'cash' | 'card' | 'mobile' | 'bank' | 'credit'
  amount: number
  reference?: string
}

export interface Sale {
  id: UUID
  deviceId: string
  branchId?: UUID
  items: CartItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payments: Payment[]
  customerId?: UUID
  customerName?: string
  cashierId?: UUID
  cashierName?: string
  shiftId?: UUID
  status: 'completed' | 'voided' | 'refunded' | 'held'
  receiptNumber: string
  note?: string
  createdAt: string
  synced: boolean
}

export interface StockMovement {
  id: UUID
  productId: UUID
  productName: string
  type: 'sale' | 'purchase' | 'adjustment' | 'transfer' | 'return' | 'damage' | 'opening'
  quantity: number          // positive = in, negative = out
  previousStock: number
  newStock: number
  reason?: string
  referenceId?: UUID        // sale id, purchase id, etc.
  userId?: UUID
  createdAt: string
  synced: boolean
}

export interface Customer {
  id: UUID
  name: string
  phone?: string
  email?: string
  address?: string
  creditLimit: number
  balance: number
  group?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: UUID
  name: string
  phone?: string
  email?: string
  address?: string
  balance: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrder {
  id: UUID
  supplierId: UUID
  supplierName: string
  items: { productId: UUID; name: string; quantity: number; cost: number }[]
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  total: number
  note?: string
  createdAt: string
  receivedAt?: string
  synced: boolean
}

export interface CashSession {
  id: UUID
  userId: UUID
  userName: string
  openingFloat: number
  closingCash?: number
  expectedCash?: number
  variance?: number
  status: 'open' | 'closed'
  openedAt: string
  closedAt?: string
  notes?: string
}

export interface Expense {
  id: UUID
  category: string
  amount: number
  paymentMethod: string
  note?: string
  userId?: UUID
  createdAt: string
  synced: boolean
}

export interface OutboxEvent {
  id: UUID
  type: 'sale' | 'stock_movement' | 'product_upsert' | 'customer_upsert' | 'supplier_upsert' | 'purchase' | 'expense' | 'shift'
  payload: unknown
  createdAt: string
  retries: number
  lastError?: string
}

export interface User {
  id: UUID
  name: string
  pin: string
  role: 'owner' | 'manager' | 'cashier' | 'storekeeper' | 'accountant'
  permissions: Permission[]
  active: boolean
}

export interface Branch {
  id: UUID
  name: string
  address?: string
  active: boolean
}

export interface AppSettings {
  id: string
  businessName: string
  businessPhone?: string
  businessAddress?: string
  currency: string
  taxRate: number
  taxInclusive: boolean
  deviceId: string
  branchId?: UUID
  offlineWindowHours: number
  receiptFooter?: string
  logoUrl?: string
}
