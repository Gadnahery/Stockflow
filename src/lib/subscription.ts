import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase'

/**
 * Offline-safe copy of billing state for the trial banner and entitlement checks.
 */
export interface SubscriptionSummary {
  business_id: string
  status: string | null // 'trialing' | 'active' | … | null when no subscription exists yet
  trial_ends_at: string | null
  current_period_end: string | null
  checked_at: string
}

const KEY = 'sf_sub_cache'

export function readSubscriptionCache(businessId: string | undefined | null): SubscriptionSummary | null {
  if (!businessId) return null
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as SubscriptionSummary | null
    return v && v.business_id === businessId ? v : null
  } catch {
    return null
  }
}

export async function refreshSubscriptionCache(businessId: string): Promise<SubscriptionSummary | null> {
  if (!supabaseConfigured || !supabase || !navigator.onLine) return readSubscriptionCache(businessId)
  try {
    const [{ data, error }, bizRes] = await Promise.all([
      supabase
        .from('business_subscriptions')
        .select('status, trial_ends_at, current_period_end')
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase
        .from('businesses')
        .select('trial_ends_at, paid_until, subscription_status')
        .eq('id', businessId)
        .maybeSingle(),
    ])
    if (error && !bizRes.data) return readSubscriptionCache(businessId)
    const row = (data ?? {}) as { status?: string; trial_ends_at?: string; current_period_end?: string }
    const biz = (bizRes.data ?? {}) as { trial_ends_at?: string; paid_until?: string; subscription_status?: string }
    // Keep local business cache in sync for entitlement
    try {
      const cached = JSON.parse(localStorage.getItem('sf_business_cache') || 'null') as Record<string, unknown> | null
      if (cached && cached.id === businessId) {
        localStorage.setItem('sf_business_cache', JSON.stringify({
          ...cached,
          trial_ends_at: biz.trial_ends_at ?? cached.trial_ends_at ?? null,
          paid_until: biz.paid_until ?? cached.paid_until ?? null,
          subscription_status: biz.subscription_status ?? cached.subscription_status ?? null,
        }))
      }
    } catch { /* ignore */ }
    const summary: SubscriptionSummary = {
      business_id: businessId,
      status: row.status ?? biz.subscription_status ?? null,
      trial_ends_at: row.trial_ends_at ?? biz.trial_ends_at ?? null,
      current_period_end: row.current_period_end ?? biz.paid_until ?? null,
      checked_at: new Date().toISOString(),
    }
    localStorage.setItem(KEY, JSON.stringify(summary))
    return summary
  } catch {
    return readSubscriptionCache(businessId)
  }
}

export type TrialState =
  | { kind: 'none' }
  | { kind: 'not-started' }
  | { kind: 'trial'; daysLeft: number }
  | { kind: 'ended' }

export function trialState(sub: SubscriptionSummary | null, now = Date.now()): TrialState {
  if (!sub) return { kind: 'none' } // nothing known yet (first launch offline) — show nothing
  if (sub.status === 'active') return { kind: 'none' }
  if (!sub.status && !sub.trial_ends_at) return { kind: 'not-started' }
  if (sub.trial_ends_at) {
    const left = new Date(sub.trial_ends_at).getTime() - now
    if (left > 0) return { kind: 'trial', daysLeft: Math.max(1, Math.ceil(left / 864e5)) }
    return { kind: 'ended' }
  }
  return { kind: 'none' }
}

export function useSubscription(businessId: string | undefined | null) {
  const [sub, setSub] = useState<SubscriptionSummary | null>(() => readSubscriptionCache(businessId))
  useEffect(() => {
    setSub(readSubscriptionCache(businessId))
    if (!businessId) return
    let alive = true
    const refresh = () => { void refreshSubscriptionCache(businessId).then((s) => { if (alive) setSub(s) }) }
    refresh()
    window.addEventListener('online', refresh)
    return () => { alive = false; window.removeEventListener('online', refresh) }
  }, [businessId])
  return sub
}
