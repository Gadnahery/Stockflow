import { createClient } from '@supabase/supabase-js'

const BASE = 'https://harakapay.net'
const jsonBody = (body) => typeof body === 'string' ? JSON.parse(body || '{}') : body || {}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.HARAKAPAY_API_KEY
  if (!url || !anonKey || !serviceKey || !apiKey) {
    return res.status(503).json({ success: false, error: 'Billing is not configured yet' })
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ success: false, error: 'Sign in required' })
  const body = jsonBody(req.body)
  const businessId = String(body.business_id || '')
  const planCode = String(body.plan_code || '')
  let phone = String(body.phone || '').replace(/\s+/g, '')
  if (phone.startsWith('+')) phone = phone.slice(1)
  if (phone.startsWith('0') && phone.length === 10) phone = '255' + phone.slice(1)
  if (!businessId || !planCode || !/^255\d{9}$/.test(phone)) {
    return res.status(400).json({ success: false, error: 'Choose a plan and enter a valid Tanzanian phone number' })
  }

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Invalid session' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: member } = await admin.from('business_members').select('role')
    .eq('business_id', businessId).eq('user_id', authData.user.id).eq('status', 'active').maybeSingle()
  if (!member || !['owner', 'business_owner', 'admin', 'platform_admin'].includes(member.role)) {
    return res.status(403).json({ success: false, error: 'Only a business owner or administrator can manage billing' })
  }

  const { data: plan } = await admin.from('billing_plans').select('id, code, name, amount_tzs, interval')
    .eq('code', planCode).eq('is_active', true).maybeSingle()
  const amount = Number(plan?.amount_tzs)
  if (!plan || !Number.isSafeInteger(amount) || amount < 100) {
    return res.status(400).json({ success: false, error: 'This billing plan is not available' })
  }

  const invoiceNumber = 'SF-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
  const { data: invoice, error: invoiceError } = await admin.from('billing_invoices').insert({
    invoice_number: invoiceNumber, business_id: businessId, plan_id: plan.id,
    amount_tzs: amount, status: 'pending', created_by: authData.user.id,
  }).select('id, invoice_number, amount_tzs').single()
  if (invoiceError || !invoice) return res.status(500).json({ success: false, error: 'Could not create invoice' })

  const { data: attempt, error: attemptError } = await admin.from('billing_payment_attempts').insert({
    invoice_id: invoice.id, provider: 'harakapay', amount_tzs: amount, phone, status: 'initiated',
  }).select('id').single()
  if (attemptError || !attempt) {
    await admin.from('billing_invoices').update({ status: 'failed' }).eq('id', invoice.id)
    return res.status(500).json({ success: false, error: 'Could not create payment attempt' })
  }

  try {
    const site = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://stockflow-taupe-six.vercel.app'
    const response = await fetch(BASE + '/api/v1/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        phone, amount,
        description: 'StockFlow invoice ' + invoice.invoice_number,
        webhook_url: site.replace(/\/$/, '') + '/api/billing/webhook',
      }),
    })
    const provider = await response.json()
    if (!response.ok || provider.success !== true || !provider.order_id || Number(provider.amount) !== amount) {
      await admin.from('billing_payment_attempts').update({ status: 'failed', metadata: { provider_error: provider.error || provider.message || 'Payment provider rejected the request or returned a mismatched amount' } }).eq('id', attempt.id)
      await admin.from('billing_invoices').update({ status: 'failed' }).eq('id', invoice.id)
      return res.status(502).json({ success: false, error: provider.error || provider.message || 'Payment request failed or provider amount did not match the selected plan' })
    }
    await admin.from('billing_payment_attempts').update({
      provider_reference: String(provider.order_id), status: 'pending',
      metadata: { provider_message: provider.message || 'USSD push sent' },
    }).eq('id', attempt.id)
    return res.status(200).json({ success: true, attempt_id: attempt.id, invoice_number: invoice.invoice_number, amount_tzs: amount, message: provider.message || 'Payment prompt sent to your phone' })
  } catch {
    await admin.from('billing_payment_attempts').update({ status: 'failed' }).eq('id', attempt.id)
    await admin.from('billing_invoices').update({ status: 'failed' }).eq('id', invoice.id)
    return res.status(502).json({ success: false, error: 'Payment provider could not be reached' })
  }
}
