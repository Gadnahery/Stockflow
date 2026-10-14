import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

/** Shown when a new service worker is waiting — one-tap update for installed PWA */
export default function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [updating, setUpdating] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const onUpdate = (e: Event) => {
      const sw = (e as CustomEvent).detail as ServiceWorker | null
      if (sw) setWaiting(sw)
    }
    window.addEventListener('sf-sw-update', onUpdate)

    // Already waiting from previous load
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) setWaiting(reg.waiting)
      reg?.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(reg.waiting || nw)
          }
        })
      })
    })

    // New SW took control → reload once
    let refreshing = false
    const onController = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)

    return () => {
      window.removeEventListener('sf-sw-update', onUpdate)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
    }
  }, [])

  if (!waiting) return null

  return (
    <div className="fixed top-[calc(var(--safe-top)+12px)] left-3 right-3 z-[60] md:left-auto md:right-4 md:w-96">
      <div className="rounded-[16px] bg-primary text-white shadow-float px-4 py-3 flex items-center gap-3">
        <RefreshCw size={18} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold">Update available</p>
          <p className="text-[12px] text-white/80">{online ? "A new version is ready. Update now to refresh StockFlow." : "A new version is ready. Connect to the internet to update safely."}</p>
        </div>
        <button
          type="button"
          className="press shrink-0 h-9 px-3 rounded-full bg-white text-primary text-[13px] font-bold"
          disabled={!online || updating}
          onClick={() => {
            if (!online || updating) return
            setUpdating(true)
            waiting.postMessage({ type: 'SKIP_WAITING' })
          }}
        >
          {updating ? 'Updating…' : online ? 'Update' : 'Connect to update'}
        </button>
      </div>
    </div>
  )
}
