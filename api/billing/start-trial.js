import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) return res.status(503).json({ success: false, error: 'Billing is not configured yet' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ success: false, error: 'Sign in required' })
  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {} } catch { return res.status(400).json({ success: false, error: 'Invalid request body' }) }
  const businessId = String(body.business_id || '')
  if (!businessId) return res.status(400).json({ success: false, error: 'business_id is required' })

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Invalid session' })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: member } = await admin.from('business_members').select('role')
    .eq('business_id', businessId).eq('user_id', authData.user.id).eq('status', 'active').maybeSingle()
  if (!member || !['owner', 'business_owner', 'admin', 'platform_admin'].includes(member.role)) {
    return res.status(403).json({ success: false, error: 'Only a business owner or administrator can start a trial' })
  }

  const { data: existing } = await admin.from('business_subscriptions')
    .select('id, status, trial_ends_at').eq('business_id', businessId).maybeSingle()
  if (existing) return res.status(409).json({ success: false, error: 'A trial or subscription already exists for this business' })

  const { data: plan } = await admin.from('billing_plans').select('id')
    .eq('code', 'starter-monthly').eq('is_active', true).maybeSingle()
  if (!plan) return res.status(503).json({ success: false, error: 'The Starter plan is not configured' })

  const start = new Date()
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  const { data: subscription, error } = await admin.from('business_subscriptions').insert({
    business_id: businessId,
    plan_id: plan.id,
    status: 'trialing',
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    trial_ends_at: end.toISOString(),
  }).select('status, trial_ends_at').single()
  if (error || !subscription) {
    return res.status(409).json({ success: false, error: 'Could not start trial. A trial or subscription may already exist.' })
  }
  return res.status(200).json({ success: true, status: subscription.status, trial_ends_at: subscription.trial_ends_at, message: 'Your 7-day StockFlow trial has started. Business operations remain available after the trial while you decide on a plan.' })
}
