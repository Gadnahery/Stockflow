import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false })
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.HARAKAPAY_API_KEY
  if (!url || !serviceKey || !apiKey) return res.status(503).json({ ok: false, error: 'Billing is not configured' })
  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {} } catch { return res.status(400).json({ ok: false }) }
  const orderId = String(body.order_id || '')
  if (!orderId) return res.status(400).json({ ok: false, error: 'Missing order id' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: attempt } = await admin.from('billing_payment_attempts').select('id, invoice_id, amount_tzs, status')
    .eq('provider_reference', orderId).maybeSingle()
  if (!attempt) return res.status(200).json({ ok: true, ignored: true })
  const { data: invoice } = await admin.from('billing_invoices').select('id, invoice_number, business_id, plan_id, amount_tzs, status')
    .eq('id', attempt.invoice_id).maybeSingle()
  if (!invoice || invoice.status === 'paid') return res.status(200).json({ ok: true, already_processed: true })

  try {
    // Never trust the webhook status or amount alone; verify directly with the provider.
    const response = await fetch('https://harakapay.net/api/v1/status/' + encodeURIComponent(orderId), { headers: { 'X-API-Key': apiKey } })
    const data = await response.json()
    const payment = data.payment || data
    if (!response.ok || payment.status !== 'completed' || Number(payment.amount) !== Number(invoice.amount_tzs) || Number(attempt.amount_tzs) !== Number(invoice.amount_tzs)) {
      return res.status(200).json({ ok: true, verified: false })
    }
    const { data: plan } = await admin.from('billing_plans').select('id, interval').eq('id', invoice.plan_id).maybeSingle()
    if (!plan) return res.status(200).json({ ok: true, error: 'Plan missing' })
    const now = new Date()
    const end = new Date(now)
    if (plan.interval === 'year') end.setFullYear(end.getFullYear() + 1)
    else end.setMonth(end.getMonth() + 1)

    await admin.from('billing_payment_attempts').update({ status: 'completed', confirmed_at: now.toISOString() }).eq('id', attempt.id)
    await admin.from('billing_invoices').update({ status: 'paid', paid_at: now.toISOString() }).eq('id', invoice.id)
    const { error } = await admin.from('business_subscriptions').upsert({
      business_id: invoice.business_id, plan_id: invoice.plan_id, status: 'active',
      current_period_start: now.toISOString(), current_period_end: end.toISOString(), updated_at: now.toISOString(),
    }, { onConflict: 'business_id' })
    if (error) return res.status(500).json({ ok: false, error: 'Subscription reconciliation failed' })
    return res.status(200).json({ ok: true, processed: true })
  } catch {
    return res.status(502).json({ ok: false, error: 'Provider verification failed' })
  }
}
