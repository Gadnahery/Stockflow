import { useI18n } from '../../i18n/I18nContext'
import { useState, type FormEvent } from 'react'
import Seo from '../../marketing/Seo'
import { breadcrumbJsonLd } from '../../lib/seo'

export default function ContactPage() {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [business, setBusiness] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState('Retail shop')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setError('Please enter your name and either email or phone.')
      return
    }
    setBusy(true)
    try {
      const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT as string | undefined
      const payload = {
        name: name.trim(),
        business: business.trim(),
        email: email.trim(),
        phone: phone.trim(),
        businessType: type,
        message: message.trim(),
        source: 'stockflow-web',
        at: new Date().toISOString(),
      }
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Submission failed')
      } else {
        // No backend configured: open mail client as a documented fallback
        const subject = encodeURIComponent(`StockFlow demo — ${business || name}`)
        const body = encodeURIComponent(
          `Name: ${name}\nBusiness: ${business}\nEmail: ${email}\nPhone: ${phone}\nType: ${type}\n\n${message}`,
        )
        window.location.href = `mailto:hello@stockflow.app?subject=${subject}&body=${body}`
      }
      setDone(true)
    } catch {
      setError('Could not send right now. Try again or email us from your mail app.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Seo
        title="Book a Demo / Contact"
        description="Request a StockFlow demo or pricing for your retail shop. Tell us about your business and we will follow up."
        path="/contact"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }])}
      />
      <div className="mx-auto max-w-xl px-4 py-12 md:py-16">
        <p className="text-[12px] font-bold tracking-widest text-primary uppercase">Contact</p>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-bold tracking-tight">Book a demo</h1>
        <p className="mt-3 text-[15px] text-ink-secondary leading-relaxed">
          Share a few details. We use this only to respond about StockFlow — not for unrelated marketing lists.
        </p>
        {done ? (
          <div className="mt-8 rounded-[18px] border border-border bg-success/10 p-5">
            <p className="font-semibold text-success">Thank you</p>
            <p className="mt-1 text-[14px] text-ink-secondary">
              Your request is ready. If your mail app opened, send the message to complete. Otherwise we will use the details you entered when a form endpoint is configured.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="auth-label" htmlFor="name">Name</label>
              <input id="name" className="field w-full" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
            <div>
              <label className="auth-label" htmlFor="business">Business name</label>
              <input id="business" className="field w-full" value={business} onChange={(e) => setBusiness(e.target.value)} autoComplete="organization" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="auth-label" htmlFor="email">Email</label>
                <input id="email" type="email" className="field w-full" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div>
                <label className="auth-label" htmlFor="phone">Phone</label>
                <input id="phone" className="field w-full" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
            </div>
            <div>
              <label className="auth-label" htmlFor="type">Business type</label>
              <select id="type" className="field w-full" value={type} onChange={(e) => setType(e.target.value)}>
                {['Retail shop', 'Minimarket', 'Electronics', 'Cosmetics', 'Stationery', 'Wholesale', 'Other'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="auth-label" htmlFor="msg">Message (optional)</label>
              <textarea id="msg" className="field w-full min-h-[100px]" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            {error && <p className="text-[14px] text-danger font-medium">{error}</p>}
            <button type="submit" disabled={busy} className="press w-full h-12 rounded-full bg-primary text-white font-semibold disabled:opacity-50">
              {busy ? 'Sending…' : 'Submit request'}
            </button>
            <p className="text-[12px] text-ink-muted">
              Optional: set <code className="text-[11px]">VITE_CONTACT_ENDPOINT</code> for server-side form delivery.
            </p>
          </form>
        )}
      </div>
    </>
  )
}
