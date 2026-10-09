import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  headerAction?: ReactNode
}

/** iOS-style bottom sheet (centered modal on desktop) with enter/exit animation. */
export default function Sheet({ open, onClose, title, children, footer, headerAction }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
    } else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => { setMounted(false); setClosing(false) }, 220)
      return () => clearTimeout(t)
    }
  }, [open, mounted])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [mounted, onClose])

  if (!mounted) return null

  return (
    <div className="sheet-backdrop" data-closing={closing} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet-panel flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl rounded-t-[28px]">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/15 md:hidden" />
          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3">
            <h2 className="text-[20px] font-bold tracking-tight text-ink">{title}</h2>
            <div className="flex items-center gap-2">
              {headerAction}
              <button
                onClick={onClose}
                aria-label="Close"
                className="press h-9 w-9 rounded-full bg-black/[0.06] text-ink-secondary flex items-center justify-center"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex-1">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-border px-5 pt-3 pb-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
