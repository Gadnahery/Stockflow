/**
 * Owner creates a staff account: email + password + role, linked to their business.
 * Requires Authorization: Bearer <user jwt>
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anon) {
    return res.status(500).json({ success: false, error: 'Server not configured' })
  }

  const auth = req.headers.authorization || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!jwt) return res.status(401).json({ success: false, error: 'Unauthorized' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}') } catch { body = {} }
  }
  body = body || {}

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const displayName = String(body.display_name || body.name || '').trim() || email.split('@')[0]
  const role = String(body.role || 'cashier')
  const permissions = Array.isArray(body.permissions) ? body.permissions : []
  const businessId = String(body.business_id || '')

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
  }
  if (!businessId) {
    return res.status(400).json({ success: false, error: 'business_id required' })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: 'Bearer ' + jwt } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) {
    return res.status(401).json({ success: false, error: 'Invalid session' })
  }

  const { data: mem } = await admin
    .from('business_members')
    .select('role, status')
    .eq('business_id', businessId)
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle()

  const okRole = mem && ['owner', 'business_owner', 'admin', 'business_manager', 'manager'].includes(mem.role)
  if (!okRole) {
    return res.status(403).json({ success: false, error: 'Only owners and managers can add staff' })
  }

  // Create auth user (or find existing)
  let userId = null
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  })

  if (createErr) {
    // User may already exist — try to find by email
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = (listed?.users || []).find((u) => (u.email || '').toLowerCase() === email)
    if (!found) {
      return res.status(400).json({ success: false, error: createErr.message || 'Could not create user' })
    }
    userId = found.id
  } else {
    userId = created.user.id
  }

  // Link to business
  const { data: existingMem } = await admin
    .from('business_members')
    .select('id, status')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingMem) {
    await admin
      .from('business_members')
      .update({
        role,
        permissions,
        status: 'active',
        display_name: displayName,
      })
      .eq('id', existingMem.id)
  } else {
    const { error: insErr } = await admin.from('business_members').insert({
      business_id: businessId,
      user_id: userId,
      role,
      permissions,
      status: 'active',
      display_name: displayName,
    })
    if (insErr) {
      return res.status(400).json({ success: false, error: insErr.message })
    }
  }

  // Best-effort profile row
  try {
    await admin.from('profiles').upsert({
      id: userId,
      email,
      full_name: displayName,
    })
  } catch { /* optional table */ }

  return res.status(200).json({
    success: true,
    user_id: userId,
    email,
    message: 'Staff account ready — they can sign in with this email and password',
  })
}
