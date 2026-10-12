import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { canInstall, isStandalone, promptInstall } from '../lib/pwa'

export default function InstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    const dismissed = sessionStorage.getItem('sf_install_dismiss')
    if (dismissed) return
    const onReady = () => setShow(true)
    window.addEventListener('sf-installable', onReady)
    if (canInstall()) setShow(true)
    return () => window.removeEventListener('sf-installable', onReady)
  }, [])

  if (!show || isStandalone()) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-96 z-40 rounded-[18px] bg-ink text-white shadow-float p-4 flex gap-3 items-start">
      <Download size={22} className="shrink-0 mt-0.5 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold">Install StockFlow</p>
        <p className="text-[13px] text-white/70 mt-0.5">
          Add to your phone or PC for offline use like a native app.
        </p>
        <button
          type="button"
          onClick={async () => {
            const r = await promptInstall()
            if (r !== 'unavailable') setShow(false)
          }}
          className="press mt-3 h-9 px-4 rounded-full bg-primary text-white text-[13px] font-semibold"
        >
          Install
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem('sf_install_dismiss', '1')
          setShow(false)
        }}
        className="press h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"
      >
        <X size={16} />
      </button>
    </div>
  )
}
