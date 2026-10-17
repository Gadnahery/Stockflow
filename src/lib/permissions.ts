/**
 * Single source of truth for StockFlow permissions.
 * UI, role presets, and can() checks all read from this catalogue.
 */
import type { Permission } from '../types'

export type PermissionGroup =
  | 'sales'
  | 'stock'
  | 'purchasing'
  | 'money'
  | 'people'
  | 'settings'
  | 'reports'

export interface PermissionMeta {
  key: Permission
  group: PermissionGroup
  labelEn: string
  labelSw: string
  descriptionEn: string
  descriptionSw: string
}

/** Full catalogue — keep in sync with Permission union in types */
export const PERMISSION_CATALOGUE: PermissionMeta[] = [
  {
    key: 'CREATE_SALE',
    group: 'sales',
    labelEn: 'Create sales',
    labelSw: 'Fanya mauzo',
    descriptionEn: 'Record sales at the till',
    descriptionSw: 'Rekodi mauzo kwenye kashia',
  },
  {
    key: 'APPLY_DISCOUNT',
    group: 'sales',
    labelEn: 'Apply discounts',
    labelSw: 'Toa punguzo',
    descriptionEn: 'Give % or amount discounts on a sale',
    descriptionSw: 'Toa punguzo la asilimia au kiasi kwenye mauzo',
  },
  {
    key: 'CHANGE_PRICE',
    group: 'sales',
    labelEn: 'Change prices at till',
    labelSw: 'Badilisha bei kwenye kashia',
    descriptionEn: 'Override the listed price when selling',
    descriptionSw: 'Badilisha bei iliyowekwa wakati wa kuuza',
  },
  {
    key: 'VOID_SALE',
    group: 'sales',
    labelEn: 'Void sales',
    labelSw: 'Batilisha mauzo',
    descriptionEn: 'Cancel a completed sale and restock',
    descriptionSw: 'Batilisha mauzo yaliyokamilika na rudisha hifadhi',
  },
  {
    key: 'REFUND_SALE',
    group: 'sales',
    labelEn: 'Refund sales',
    labelSw: 'Rudisha pesa za mauzo',
    descriptionEn: 'Full or partial refund with optional restock',
    descriptionSw: 'Rudisha pesa kamili au sehemu, na chaguo la kurejesha hifadhi',
  },
  {
    key: 'APPROVE_OVERRIDE',
    group: 'sales',
    labelEn: 'Approve overrides',
    labelSw: 'Idhinisha mambo nyeti',
    descriptionEn: 'Approve void/refund/expired sale for staff without permission (device PIN)',
    descriptionSw: 'Idhinisha batilisho/rejesho kwa wafanyakazi wasio na ruhusa (PIN ya kifaa)',
  },
  {
    key: 'MANAGE_PRODUCTS',
    group: 'stock',
    labelEn: 'Manage products',
    labelSw: 'Simamia bidhaa',
    descriptionEn: 'Add and edit products',
    descriptionSw: 'Ongeza na hariri bidhaa',
  },
  {
    key: 'ADJUST_STOCK',
    group: 'stock',
    labelEn: 'Adjust stock',
    labelSw: 'Rekebisha hifadhi',
    descriptionEn: 'Manual stock counts and corrections',
    descriptionSw: 'Hesabu na marekebisho ya hifadhi',
  },
  {
    key: 'TRANSFER_STOCK',
    group: 'stock',
    labelEn: 'Transfer stock',
    labelSw: 'Hamisha hifadhi',
    descriptionEn: 'Move stock between store and shop or branches',
    descriptionSw: 'Hamisha hifadhi kati ya stoo na duka au matawi',
  },
  {
    key: 'CREATE_PO',
    group: 'purchasing',
    labelEn: 'Create purchase orders',
    labelSw: 'Unda maagizo ya ununuzi',
    descriptionEn: 'Raise purchase orders to suppliers',
    descriptionSw: 'Tengeneza maagizo kwa wasambazaji',
  },
  {
    key: 'RECEIVE_PO',
    group: 'purchasing',
    labelEn: 'Receive goods',
    labelSw: 'Pokea bidhaa',
    descriptionEn: 'Receive stock against a purchase order',
    descriptionSw: 'Pokea hifadhi kulingana na agizo la ununuzi',
  },
  {
    key: 'MANAGE_SUPPLIERS',
    group: 'purchasing',
    labelEn: 'Manage suppliers',
    labelSw: 'Simamia wasambazaji',
    descriptionEn: 'Add and edit suppliers',
    descriptionSw: 'Ongeza na hariri wasambazaji',
  },
  {
    key: 'MANAGE_CUSTOMERS',
    group: 'money',
    labelEn: 'Manage customers',
    labelSw: 'Simamia wateja',
    descriptionEn: 'Customers and credit limits',
    descriptionSw: 'Wateja na kikomo cha deni',
  },
  {
    key: 'MANAGE_EXPENSES',
    group: 'money',
    labelEn: 'Manage expenses',
    labelSw: 'Simamia matumizi',
    descriptionEn: 'Record business expenses',
    descriptionSw: 'Rekodi matumizi ya biashara',
  },
  {
    key: 'MANAGE_SHIFTS',
    group: 'money',
    labelEn: 'Manage shifts',
    labelSw: 'Simamia zamu',
    descriptionEn: 'Open and close cash shifts',
    descriptionSw: 'Fungua na funga zamu za fedha',
  },
  {
    key: 'VIEW_PROFIT',
    group: 'reports',
    labelEn: 'View profit and cost',
    labelSw: 'Ona faida na gharama',
    descriptionEn: 'See cost and margin on reports',
    descriptionSw: 'Ona gharama na faida kwenye ripoti',
  },
  {
    key: 'VIEW_REPORTS',
    group: 'reports',
    labelEn: 'View reports',
    labelSw: 'Ona ripoti',
    descriptionEn: 'Sales, stock and profit reports',
    descriptionSw: 'Ripoti za mauzo, hifadhi na faida',
  },
  {
    key: 'EXPORT_DATA',
    group: 'reports',
    labelEn: 'Export data',
    labelSw: 'Hamisha data',
    descriptionEn: 'CSV / PDF export',
    descriptionSw: 'Hamisha CSV / PDF',
  },
  {
    key: 'VIEW_AUDIT',
    group: 'reports',
    labelEn: 'View audit log',
    labelSw: 'Ona kumbukumbu za ukaguzi',
    descriptionEn: 'Who changed what and when',
    descriptionSw: 'Nani alibadilisha nini na lini',
  },
  {
    key: 'MANAGE_USERS',
    group: 'people',
    labelEn: 'Manage users',
    labelSw: 'Simamia watumiaji',
    descriptionEn: 'Invite staff and assign permissions',
    descriptionSw: 'Alika wafanyakazi na toa ruhusa',
  },
  {
    key: 'MANAGE_BRANCHES',
    group: 'settings',
    labelEn: 'Manage branches',
    labelSw: 'Simamia matawi',
    descriptionEn: 'Create branches and catalogue mode',
    descriptionSw: 'Unda matawi na hali ya orodha',
  },
  {
    key: 'MANAGE_BILLING',
    group: 'settings',
    labelEn: 'Manage billing',
    labelSw: 'Simamia malipo ya usajili',
    descriptionEn: 'Plans and payments',
    descriptionSw: 'Mipango na malipo',
  },
  {
    key: 'MANAGE_SETTINGS',
    group: 'settings',
    labelEn: 'Manage settings',
    labelSw: 'Simamia mipangilio',
    descriptionEn: 'Shop name, tax, receipts, PIN',
    descriptionSw: 'Jina la duka, kodi, risiti, PIN',
  },
]

export const PERMISSION_KEYS: Permission[] = PERMISSION_CATALOGUE.map((p) => p.key)

export const GROUP_LABELS: Record<PermissionGroup, { en: string; sw: string }> = {
  sales: { en: 'Sales', sw: 'Mauzo' },
  stock: { en: 'Stock', sw: 'Hifadhi' },
  purchasing: { en: 'Purchasing', sw: 'Ununuzi' },
  money: { en: 'Money', sw: 'Fedha' },
  people: { en: 'People', sw: 'Watu' },
  settings: { en: 'Settings', sw: 'Mipangilio' },
  reports: { en: 'Reports', sw: 'Ripoti' },
}

/** Role presets — starting points; admin can customise per user */
export const ROLE_PRESETS: Record<string, Permission[]> = {
  business_owner: [...PERMISSION_KEYS],
  owner: [...PERMISSION_KEYS],
  platform_admin: [...PERMISSION_KEYS],
  business_manager: [
    'CREATE_SALE',
    'APPLY_DISCOUNT',
    'CHANGE_PRICE',
    'VOID_SALE',
    'REFUND_SALE',
    'APPROVE_OVERRIDE',
    'MANAGE_PRODUCTS',
    'ADJUST_STOCK',
    'TRANSFER_STOCK',
    'CREATE_PO',
    'RECEIVE_PO',
    'MANAGE_SUPPLIERS',
    'MANAGE_CUSTOMERS',
    'MANAGE_EXPENSES',
    'MANAGE_SHIFTS',
    'VIEW_PROFIT',
    'VIEW_REPORTS',
    'EXPORT_DATA',
    'VIEW_AUDIT',
    'MANAGE_USERS',
    'MANAGE_BRANCHES',
    'MANAGE_SETTINGS',
  ],
  manager: [
    'CREATE_SALE',
    'APPLY_DISCOUNT',
    'CHANGE_PRICE',
    'VOID_SALE',
    'REFUND_SALE',
    'APPROVE_OVERRIDE',
    'MANAGE_PRODUCTS',
    'ADJUST_STOCK',
    'RECEIVE_PO',
    'MANAGE_CUSTOMERS',
    'MANAGE_EXPENSES',
    'MANAGE_SHIFTS',
    'VIEW_PROFIT',
    'VIEW_REPORTS',
  ],
  cashier: ['CREATE_SALE', 'APPLY_DISCOUNT'],
  storekeeper: [
    'MANAGE_PRODUCTS',
    'ADJUST_STOCK',
    'TRANSFER_STOCK',
    'CREATE_PO',
    'RECEIVE_PO',
    'MANAGE_SUPPLIERS',
  ],
  accountant: ['VIEW_REPORTS', 'VIEW_PROFIT', 'EXPORT_DATA', 'VIEW_AUDIT', 'MANAGE_EXPENSES'],
  auditor: ['VIEW_REPORTS', 'VIEW_PROFIT', 'EXPORT_DATA', 'VIEW_AUDIT'],
  waiter: ['CREATE_SALE'],
}

export const ROLE_LABELS: Record<string, { en: string; sw: string }> = {
  business_owner: { en: 'Owner', sw: 'Mmiliki' },
  owner: { en: 'Owner', sw: 'Mmiliki' },
  platform_admin: { en: 'Platform admin', sw: 'Msimamizi' },
  business_manager: { en: 'Manager', sw: 'Meneja' },
  manager: { en: 'Manager', sw: 'Meneja' },
  cashier: { en: 'Cashier', sw: 'Kashia' },
  storekeeper: { en: 'Storekeeper', sw: 'Mhifadhi' },
  accountant: { en: 'Accountant', sw: 'Mhasibu' },
  auditor: { en: 'Auditor', sw: 'Mkaguzi' },
  waiter: { en: 'Waiter', sw: 'Mhudumu' },
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return ['owner', 'business_owner', 'platform_admin'].includes(String(role || ''))
}

export function hasPermission(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
  needed: Permission,
): boolean {
  if (isOwnerRole(role)) return true
  return (permissions || []).includes(needed)
}

/** Permissions that allow approving void/refund for others */
export function canApproveOverrides(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
): boolean {
  return (
    isOwnerRole(role) ||
    hasPermission(role, permissions, 'APPROVE_OVERRIDE') ||
    hasPermission(role, permissions, 'VOID_SALE') ||
    hasPermission(role, permissions, 'REFUND_SALE')
  )
}

export function permissionsByGroup(): Record<PermissionGroup, PermissionMeta[]> {
  const out = {} as Record<PermissionGroup, PermissionMeta[]>
  for (const p of PERMISSION_CATALOGUE) {
    if (!out[p.group]) out[p.group] = []
    out[p.group].push(p)
  }
  return out
}
