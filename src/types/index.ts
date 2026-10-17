export type UUID = string

export type Permission =
  | 'CREATE_SALE'
  | 'VOID_SALE'
  | 'REFUND_SALE'
  | 'CHANGE_PRICE'
  | 'APPLY_DISCOUNT'
  | 'APPROVE_OVERRIDE'
  | 'ADJUST_STOCK'
  | 'TRANSFER_STOCK'
  | 'CREATE_PO'
  | 'RECEIVE_PO'
  | 'VIEW_PROFIT'
  | 'EXPORT_DATA'
  | 'VIEW_AUDIT'
  | 'MANAGE_USERS'
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_SUPPLIERS'
  | 'MANAGE_EXPENSES'
  | 'VIEW_REPORTS'
  | 'MANAGE_SHIFTS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_BRANCHES'
  | 'MANAGE_BILLING'

export interface Product {
  /** Pharmacy: lot / batch */
  batchNumber?: string
  /** Pharmacy: expiry ISO date */
  expiryDate?: string
  /** Restricted item (pharmacy / liquor) */
  restricted?: boolean
  /** Service line (salon/restaurant) — skip stock deduct if true */
  isService?: boolean

  id: UUID
  /** When catalogMode is isolated, product belongs to this branch only */
  branchId?: UUID
  name: string
  sku: string
  barcode?: string
  price: number
  cost: number
  stock: number
  /** Back-room / store quantity (dual-location mode). POS sells from stock (shop). */
  storeStock?: number
  minStock?: number
  category?: string
  brand?: string
  unit?: string
  /** How many base units in one pack (e.g. 30 eggs per tray). Stock is always base units. */
  packQty?: number
  /** Name of the pack unit, e.g. tray, dozen, carton */
  packName?: string
  /** Sell price for one pack (if set). Base price stays on price. */
  packPrice?: number
  /** Buy cost for one pack (e.g. tray). Per-unit cost = packCost / packQty when set. */
  packCost?: number
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
  /** Selling as pack vs single (reja reja) */
  sellAs?: 'unit' | 'pack'
  /** Base units this line will deduct from stock */
  stockUnits?: number
  unitLabel?: string
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
  /** Sequential fiscal-style number when fiscalMode is prepare/vfd */
  fiscalReceiptNumber?: string
  note?: string
  /** Manager who approved void/refund when cashier lacked permission */
  approvedById?: string
  approvedByName?: string
  voidReason?: string
  refundReason?: string
  /** Partial refund: money returned (full total if whole sale) */
  refundAmount?: number
  createdAt: string
  synced: boolean
}

export interface ProductBatch {
  id: UUID
  productId: UUID
  productName: string
  batchNo?: string
  expiryDate?: string // ISO date YYYY-MM-DD
  quantity: number
  /** shop = selling floor, store = back room */
  location: 'shop' | 'store'
  branchId?: UUID
  createdAt: string
  updatedAt: string
  synced?: boolean
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
  branchId?: UUID
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
  /** Printed order number, e.g. PO-2026-0007 */
  poNumber?: string
  expectedDate?: string
  deliveryAddress?: string
  paymentTerms?: string
  authorizedBy?: string
  items: { productId: UUID; name: string; quantity: number; cost: number; /** quantity received so far */ received?: number }[]
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
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
  /** Branch that recorded this expense */
  branchId?: UUID
  createdAt: string
  synced: boolean
}

export interface OutboxEvent {
  id: UUID
  type: 'sale' | 'stock_movement' | 'product_upsert' | 'customer_upsert' | 'supplier_upsert' | 'purchase' | 'expense' | 'shift' | 'audit'
  payload: unknown
  createdAt: string
  retries: number
  lastError?: string
}

export interface User {
  id: UUID
  name: string
  pin: string
  role: 'owner' | 'business_owner' | 'manager' | 'business_manager' | 'cashier' | 'storekeeper' | 'accountant' | 'waiter' | 'auditor' | 'platform_admin'
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
  /** Tanzania Revenue Authority TIN (for future VFD / fiscal receipts) */
  tinNumber?: string
  /** Business registration / VRN if applicable */
  vrnNumber?: string
  /** Fiscal mode: off | prepare (numbers only) | vfd (device path, when certified) */
  fiscalMode?: 'off' | 'prepare' | 'vfd'
  /** Last sequential fiscal receipt counter on this device */
  fiscalReceiptSeq?: number
  /** Feature-flagged shop type from SRS §8 */
  industryType?: 'retail' | 'restaurant' | 'pharmacy' | 'liquor' | 'salon' | 'wholesale'
  stockMode?: 'shared' | 'per_branch'
  /**
   * shared = same product list for every branch (default)
   * isolated = each branch has its own products (empty until you add them); like a second shop under same owner
   */
  catalogMode?: 'shared' | 'isolated'
  /** Show expiry fields (pharmacy / food) */
  trackExpiry?: boolean
  /** Shop floor vs back-room store quantities */
  dualLocationStock?: boolean
  /** Last sequential A4 invoice number */
  invoiceSeq?: number
}

/** Per-branch quantity when stockMode is per_branch. Catalogue products stay shared. */
export interface BranchStock {
  id: string // `${productId}:${branchId}`
  productId: UUID
  branchId: UUID
  stock: number
  /** Back-room / store quantity (dual-location mode). POS sells from stock (shop). */
  storeStock?: number
  minStock?: number
  updatedAt: string
  synced?: boolean
}


export interface AuditLog {
  id: UUID
  action: string // e.g. SALE_VOID, PRICE_CHANGE, STOCK_ADJUST, DISCOUNT, CUSTOMER_PAYMENT, DATA_IMPORT
  entityType?: string
  entityId?: string
  before?: unknown
  after?: unknown
  reason?: string
  userId?: string
  userName?: string
  deviceId?: string
  createdAt: string
}

export interface HeldCart {
  id: UUID
  items: CartItem[]
  customerId: string | null
  customerName: string | null
  createdAt: string
}
