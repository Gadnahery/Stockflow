import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false })
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const orderId = String(body.order_id || '')
  const status = String(body.status || '')
  if (!orderId) return res.status(200).json({ ok: true, skipped: true })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('webhook: missing Supabase service role')
    return res.status(200).json({ ok: true, configured: false })
  }
  const admin = createClient(url, key, { auth: { persistSession: false } })
  try {
    const { data: order } = await admin
      .from('payment_orders')
      .select('id, business_id, amount, status')
      .eq('order_id', orderId)
      .maybeSingle()
    if (order) {
      await admin
        .from('payment_orders')
        .update({
          status,
          net_amount: body.net_amount ?? null,
          fee_amount: body.fee_amount ?? body.fee ?? null,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          raw: body,
        })
        .eq('order_id', orderId)
      if (status === 'completed' && order.business_id) {
        const paidUntil = new Date()
        paidUntil.setDate(paidUntil.getDate() + 30)
        await admin
          .from('businesses')
          .update({
            subscription_status: 'active',
            paid_until: paidUntil.toISOString(),
            last_payment_order_id: orderId,
            last_payment_at: new Date().toISOString(),
          })
          .eq('id', order.business_id)
      }
    }
  } catch (e) {
    console.error('webhook error', e)
  }
  return res.status(200).json({ ok: true })
}
