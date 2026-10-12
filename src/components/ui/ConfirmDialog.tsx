import { useEffect, useState, useCallback, createContext, useContext, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** danger = red destructive action */
  tone?: 'default' | 'danger'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null)
  const [closing, setClosing] = useState(false)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setClosing(false)
      setOpts(options)
      setResolver(() => resolve)
    })
  }, [])

  const finish = useCallback(
    (value: boolean) => {
      setClosing(true)
      setTimeout(() => {
        resolver?.(value)
        setResolver(null)
        setOpts(null)
        setClosing(false)
      }, 180)
    },
    [resolver],
  )

  useEffect(() => {
    if (!opts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opts, finish])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {opts &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-6"
            data-closing={closing}
            style={{
              background: closing ? 'transparent' : 'rgba(0,0,0,0.36)',
              transition: 'background 0.18s ease',
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) finish(false)
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby={opts.message ? 'confirm-msg' : undefined}
              className="w-full max-w-[320px] rounded-[20px] bg-white shadow-float overflow-hidden"
              style={{
                transform: closing ? 'scale(0.96)' : 'scale(1)',
                opacity: closing ? 0 : 1,
                transition: 'transform 0.18s cubic-bezier(0.32,0.72,0,1), opacity 0.18s ease',
              }}
            >
              <div className="px-5 pt-5 pb-4 text-center">
                <h2 id="confirm-title" className="text-[17px] font-semibold text-[#1C1C1E] tracking-tight">
                  {opts.title}
                </h2>
                {opts.message && (
                  <p id="confirm-msg" className="mt-2 text-[14px] text-[#636366] leading-snug">
                    {opts.message}
                  </p>
                )}
              </div>
              <div className="flex border-t border-black/[0.08]">
                <button
                  type="button"
                  onClick={() => finish(false)}
                  className="press flex-1 h-[48px] text-[16px] font-medium text-[#007AFF] border-r border-black/[0.08]"
                >
                  {opts.cancelLabel || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => finish(true)}
                  className={`press flex-1 h-[48px] text-[16px] font-semibold ${
                    opts.tone === 'danger' ? 'text-[#E0333C]' : 'text-[#007AFF]'
                  }`}
                >
                  {opts.confirmLabel || 'OK'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    // Fallback so pages still work outside provider
    return async (opts) => window.confirm([opts.title, opts.message].filter(Boolean).join('\n\n'))
  }
  return ctx
}
