import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useUi } from '../../store/uiStore'

interface ScreenProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}

/** iOS-style screen: large title that collapses into a translucent bar as you scroll. */
export default function Screen({ title, subtitle, action, children }: ScreenProps) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(0)
  const [scrolled, setScrolled] = useState(false)
  const setTabCompact = useUi((s) => s.setTabCompact)

  useEffect(() => () => setTabCompact(false), [setTabCompact])

  const onScroll = () => {
    const top = ref.current?.scrollTop ?? 0
    setScrolled(top > 36)
    const delta = top - last.current
    if (top < 60) setTabCompact(false)
    else if (delta > 8) setTabCompact(true)
    else if (delta < -8) setTabCompact(false)
    last.current = top
  }

  return (
    <div ref={ref} onScroll={onScroll} className="h-full overflow-y-auto relative">
      <div
        className="sticky top-0 z-20 transition-[background-color,box-shadow] duration-300"
        style={{
          paddingTop: 'var(--safe-top)',
          background: scrolled ? 'var(--glass)' : 'transparent',
          WebkitBackdropFilter: scrolled ? 'saturate(180%) blur(24px)' : 'none',
          backdropFilter: scrolled ? 'saturate(180%) blur(24px)' : 'none',
          boxShadow: scrolled ? '0 0.5px 0 var(--hairline)' : 'none',
        }}
      >
        <div className="relative h-12 px-5 md:px-7 flex items-center justify-end">
          <span
            className="absolute inset-x-0 text-center text-[17px] font-semibold text-ink pointer-events-none transition-opacity duration-200"
            style={{ opacity: scrolled ? 1 : 0 }}
          >
            {title}
          </span>
          <div className="relative flex items-center gap-2">{action}</div>
        </div>
      </div>

      <div className="px-5 md:px-7 -mt-9 pb-3">
        <h1 className="page-title text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-secondary">{subtitle}</p>}
      </div>

      <div className="px-5 md:px-7 scroll-pad">{children}</div>
    </div>
  )
}
