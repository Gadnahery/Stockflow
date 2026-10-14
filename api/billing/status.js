import { createClient } from '@supabase/supabase-js'

async function confirmCompleted(admin, attempt, invoice, providerPayment) {
  const paidAmount = Number(providerPayment?.amount)
  if (providerPayment?.status !== 'completed' || paidAmount !== Number(invoice.amount_tzs)) {
    return { success: false, pending: providerPayment?.status === 'pending', error: providerPayment?.status === 'completed' ? 'Payment amount did not match invoice' : 'Payment is not completed yet' }
  }
  const now = new Date()
  const { data: plan } = await admin.from('billing_plans').select('id, interval').eq('id', invoice.plan_id).maybeSingle()
  if (!plan) return { success: false, error: 'Invoice plan could not be found' }
  const { data: current } = await admin.from('business_subscriptions').select('current_period_end').eq('business_id', invoice.business_id).maybeSingle()
  const existingEnd = current?.current_period_end ? new Date(current.current_period_end) : null
  const periodStart = existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now
  const periodEnd = new Date(periodStart)
  if (plan.interval === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  else periodEnd.setMonth(periodEnd.getMonth() + 1)

  // Persist the subscription first. If that fails, invoice remains pending and can be retried.
  const { error: subscriptionError } = await admin.from('business_subscriptions').upsert({
    business_id: invoice.business_id, plan_id: invoice.plan_id, status: 'active',
    current_period_start: periodStart.toISOString(), current_period_end: periodEnd.toISOString(), updated_at: now.toISOString(),
  }, { onConflict: 'business_id' })
  if (subscriptionError) return { success: false, error: 'Payment was confirmed, but subscription status needs reconciliation' }
  const { error: attemptError } = await admin.from('billing_payment_attempts').update({ status: 'completed', confirmed_at: now.toISOString() }).eq('id', attempt.id)
  const { error: invoiceError } = await admin.from('billing_invoices').update({ status: 'paid', paid_at: now.toISOString() }).eq('id', invoice.id)
  if (attemptError || invoiceError) return { success: false, error: 'Subscription is active; invoice records need reconciliation' }
  return { success: true, status: 'paid', invoice_number: invoice.invoice_number, paid_at: now.toISOString() }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.HARAKAPAY_API_KEY
  if (!url || !anonKey || !serviceKey || !apiKey) return res.status(503).json({ success: false, error: 'Billing is not configured yet' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ success: false, error: 'Sign in required' })
  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {} } catch { return res.status(400).json({ success: false, error: 'Invalid request body' }) }
  const attemptId = String(body.attempt_id || '')
  if (!attemptId) return res.status(400).json({ success: false, error: 'attempt_id is required' })

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Invalid session' })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: attempt } = await admin.from('billing_payment_attempts').select('id, provider_reference, status, invoice_id').eq('id', attemptId).maybeSingle()
  if (!attempt) return res.status(404).json({ success: false, error: 'Payment attempt not found' })
  const { data: invoice } = await admin.from('billing_invoices').select('id, invoice_number, business_id, plan_id, amount_tzs, status').eq('id', attempt.invoice_id).maybeSingle()
  if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' })
  const { data: member } = await admin.from('business_members').select('role').eq('business_id', invoice.business_id).eq('user_id', authData.user.id).eq('status', 'active').maybeSingle()
  if (!member) return res.status(403).json({ success: false, error: 'Not allowed' })
  if (invoice.status === 'paid' || attempt.status === 'completed') return res.status(200).json({ success: true, status: 'paid', invoice_number: invoice.invoice_number })
  if (!attempt.provider_reference) return res.status(409).json({ success: false, error: 'Payment reference is not ready yet' })

  try {
    const response = await fetch('https://harakapay.net/api/v1/status/' + encodeURIComponent(attempt.provider_reference), { headers: { 'X-API-Key': apiKey } })
    const data = await response.json()
    if (!response.ok) return res.status(502).json({ success: false, error: 'Could not verify payment status' })
    const payment = data.payment || data
    if (payment.status === 'failed') {
      await admin.from('billing_payment_attempts').update({ status: 'failed' }).eq('id', attempt.id)
      await admin.from('billing_invoices').update({ status: 'failed' }).eq('id', invoice.id).eq('status', 'pending')
      return res.status(200).json({ success: false, status: 'failed', error: 'Payment failed. You can start a new attempt.' })
    }
    if (payment.status !== 'completed') return res.status(200).json({ success: true, status: 'pending', message: 'Payment is still pending on your phone.' })
    const result = await confirmCompleted(admin, attempt, invoice, payment)
    return res.status(result.success ? 200 : 409).json(result)
  } catch {
    return res.status(502).json({ success: false, error: 'Could not verify payment status right now' })
  }
}
