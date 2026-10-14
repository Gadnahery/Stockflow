import { createClient, type Session, type User } from '@supabase/supabase-js'
import type { Permission } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>)

/** Business membership row returned by API */
export interface BusinessMember {
  id: string
  business_id: string
  user_id: string
  role: string
  permissions: Permission[]
  branch_ids: string[]
  status: string
  display_name?: string | null
  pin_hash?: string | null
  last_seen_at?: string | null
}

export interface Business {
  id: string
  name: string
  slug?: string | null
}

const BUSINESS_ID_KEY = 'businessId'
const BRANCH_ID_KEY = 'branchId'
const MEMBER_CACHE_KEY = 'sf_member_cache'
const BUSINESS_CACHE_KEY = 'sf_business_cache'

export function getBusinessId(): string | null {
  return localStorage.getItem(BUSINESS_ID_KEY)
}

export function setBusinessId(id: string) {
  localStorage.setItem(BUSINESS_ID_KEY, id)
}

export function clearBusinessId() {
  localStorage.removeItem(BUSINESS_ID_KEY)
}

export function getBranchId(): string | null {
  return localStorage.getItem(BRANCH_ID_KEY)
}

export function setBranchId(id: string) {
  localStorage.setItem(BRANCH_ID_KEY, id)
}

export function cacheBusiness(business: Business | null) {
  try {
    if (business) localStorage.setItem(BUSINESS_CACHE_KEY, JSON.stringify(business))
    else localStorage.removeItem(BUSINESS_CACHE_KEY)
  } catch { /* ignore storage failures */ }
}

export function getCachedBusiness(): Business | null {
  try {
    const raw = localStorage.getItem(BUSINESS_CACHE_KEY)
    return raw ? JSON.parse(raw) as Business : null
  } catch { return null }
}

export function cacheMember(member: BusinessMember | null) {
  if (member) localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify(member))
  else localStorage.removeItem(MEMBER_CACHE_KEY)
}

export function getCachedMember(): BusinessMember | null {
  try {
    const raw = localStorage.getItem(MEMBER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as BusinessMember) : null
  } catch {
    return null
  }
}

/** Load the active membership for the current auth user. */
export async function fetchMembership(userId: string): Promise<{
  member: BusinessMember | null
  business: Business | null
}> {
  if (!supabaseConfigured || !supabase) return { member: null, business: null }

  // On launch without internet, use the last verified session's local business cache immediately.
  if (!navigator.onLine) {
    const cachedMember = getCachedMember()
    if (cachedMember?.status === 'active' && cachedMember.user_id === userId) {
      return { member: cachedMember, business: getCachedBusiness() }
    }
    return { member: null, business: null }
  }

  const { data: members, error } = await supabase
    .from('business_members')
    .select('id, business_id, user_id, role, permissions, branch_ids, status, display_name, pin_hash, last_seen_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)

  if (error || !members?.length) {
    if (error) {
      const cachedMember = getCachedMember()
      const cachedBusiness = getCachedBusiness()
      if (cachedMember?.status === 'active') return { member: cachedMember, business: cachedBusiness }
    }
    return { member: null, business: null }
  }

  const member = members[0] as BusinessMember
  setBusinessId(member.business_id)
  // Owners can switch among all business branches. Do not reset their selected branch
  // to branch_ids[0] during every membership refresh.
  const isOwner = ['owner', 'business_owner', 'platform_admin'].includes(String(member.role))
  if (!isOwner && member.branch_ids?.length) {
    const selected = getBranchId()
    if (!selected || !member.branch_ids.includes(selected)) setBranchId(member.branch_ids[0])
  }
  cacheMember(member)

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name, slug')
    .eq('id', member.business_id)
    .maybeSingle()

  const cachedBusiness = getCachedBusiness()
  const business = (biz as Business) ?? (cachedBusiness?.id === member.business_id ? cachedBusiness : null)
  if (business) cacheBusiness(business)
  // Do not retain another workspace's stale entitlement when business details are unavailable.
  return { member, business }
}

export async function createBusiness(name: string, phone?: string, address?: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('create_business', {
    p_name: name,
    p_phone: phone ?? null,
    p_address: address ?? null,
  })
  if (error) throw error
  return data as string
}

export async function acceptInvite(token: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
  if (error) throw error
  return data as string
}

export type { Session, User }
