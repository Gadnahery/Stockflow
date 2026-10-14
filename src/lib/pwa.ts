/** Register service worker, install prompt, and update detection (PC + phone). */

let deferredPrompt: any = null

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js?v=6')
      .then((reg) => {
        // Check for updates on load and periodically
        reg.update().catch(() => {})
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)

        if (reg.waiting) {
          window.dispatchEvent(new CustomEvent('sf-sw-update', { detail: reg.waiting }))
        }
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(
                new CustomEvent('sf-sw-update', { detail: reg.waiting || nw }),
              )
            }
          })
        })
      })
      .catch((e) => {
        console.warn('SW register failed', e)
      })
  })
}

export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    window.dispatchEvent(new CustomEvent('sf-installable'))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    window.dispatchEvent(new CustomEvent('sf-installed'))
  })
}

export function canInstall(): boolean {
  return Boolean(deferredPrompt)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  return outcome === 'accepted' ? 'accepted' : 'dismissed'
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}
