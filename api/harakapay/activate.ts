import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * After client polls status === completed, call this with JWT + order_id + business_id
 * to extend subscription (also handled by webhook when service role is set).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const apiKey = process.env.HARAKAPAY_API_KEY
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!apiKey || !url || !serviceKey) {
    return res.status(500).json({ success: false, error: 'Server not configured' })
  }

  const auth = req.headers.authorization || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!jwt) return res.status(401).json({ success: false, error: 'Unauthorized' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const orderId = String(body.order_id || '')
  const businessId = String(body.business_id || '')
  if (!orderId || !businessId) {
    return res.status(400).json({ success: false, error: 'order_id and business_id required' })
  }

  // Verify payment with HarakaPay
  const statusRes = await fetch(`https://harakapay.net/api/v1/status/${encodeURIComponent(orderId)}`, {
    headers: { 'X-API-Key': apiKey },
  })
  const statusData = (await statusRes.json()) as {
    success?: boolean
    payment?: { status?: string; amount?: number }
  }
  const payStatus = statusData.payment?.status
  if (payStatus !== 'completed') {
    return res.status(400).json({ success: false, error: 'Payment not completed', status: payStatus })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const userClient = createClient(url, process.env.VITE_SUPABASE_ANON_KEY || serviceKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) {
    return res.status(401).json({ success: false, error: 'Invalid session' })
  }

  // Ensure user is owner/admin of business
  const { data: mem } = await admin
    .from('business_members')
    .select('role')
    .eq('business_id', businessId)
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!mem || !['owner', 'admin'].includes(mem.role)) {
    return res.status(403).json({ success: false, error: 'Not allowed' })
  }

  const paidUntil = new Date()
  paidUntil.setDate(paidUntil.getDate() + 30)

  await admin.from('payment_orders').upsert(
    {
      order_id: orderId,
      business_id: businessId,
      user_id: userData.user.id,
      amount: statusData.payment?.amount ?? 25000,
      status: 'completed',
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' },
  )

  await admin
    .from('businesses')
    .update({
      subscription_status: 'active',
      paid_until: paidUntil.toISOString(),
      last_payment_order_id: orderId,
      last_payment_at: new Date().toISOString(),
    })
    .eq('id', businessId)

  return res.status(200).json({
    success: true,
    subscription_status: 'active',
    paid_until: paidUntil.toISOString(),
  })
}
