import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = supabaseConfigured
  ? createClient(url, anonKey)
  : (null as unknown as ReturnType<typeof createClient>)

/** Default business id — set after first sync / seed */
export function getBusinessId(): string | null {
  return localStorage.getItem('businessId')
}

export function setBusinessId(id: string) {
  localStorage.setItem('businessId', id)
}
