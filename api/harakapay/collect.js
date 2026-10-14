const BASE = 'https://harakapay.net'
const MONTHLY_TZS = 25000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const apiKey = process.env.HARAKAPAY_API_KEY
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'Payment gateway not configured' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  let phone = String(body.phone || '').replace(/\s+/g, '')
  const amount = Number(body.amount ?? MONTHLY_TZS)
  const description = String(body.description || 'StockFlow monthly subscription')
  const businessId = body.business_id ? String(body.business_id) : ''

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number required' })
  }
  if (phone.startsWith('0') && phone.length === 10) phone = '255' + phone.slice(1)
  if (phone.startsWith('+')) phone = phone.slice(1)

  if (!Number.isFinite(amount) || amount < 100) {
    return res.status(400).json({ success: false, error: 'Invalid amount' })
  }

  const site = process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://stockflow-taupe-six.vercel.app'
  const webhook = `${site.replace(/\/$/, '')}/api/harakapay/webhook`

  try {
    const r = await fetch(`${BASE}/api/v1/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        phone,
        amount,
        description: businessId ? `${description} (${businessId.slice(0, 8)})` : description,
        webhook_url: webhook,
      }),
    })
    const data = await r.json()
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: data.error || data.message || 'Collect failed',
        data,
      })
    }
    return res.status(200).json({
      success: true,
      order_id: data.order_id,
      amount: data.amount ?? amount,
      net_amount: data.net_amount,
      fee: data.fee,
      message: data.message || 'USSD push sent',
      business_id: businessId || undefined,
    })
  } catch (e) {
    return res.status(502).json({
      success: false,
      error: e instanceof Error ? e.message : 'Gateway error',
    })
  }
}
