const BASE = 'https://harakapay.net'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const apiKey = process.env.HARAKAPAY_API_KEY
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'Payment gateway not configured' })
  }
  const orderId = String(req.query.order_id || req.query.orderId || '')
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'order_id required' })
  }
  try {
    const r = await fetch(`${BASE}/api/v1/status/${encodeURIComponent(orderId)}`, {
      headers: { 'X-API-Key': apiKey },
    })
    const data = await r.json()
    return res.status(r.ok ? 200 : r.status).json(data)
  } catch (e) {
    return res.status(502).json({
      success: false,
      error: e instanceof Error ? e.message : 'Gateway error',
    })
  }
}
