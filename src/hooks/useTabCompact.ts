import { useCallback, useEffect, useRef, type UIEvent } from 'react'
import { useUi } from '../store/uiStore'

/** Shrinks the floating tab bar while scrolling down, restores it when scrolling up. */
export function useTabCompact() {
  const last = useRef(0)
  const setTabCompact = useUi((s) => s.setTabCompact)
  useEffect(() => () => setTabCompact(false), [setTabCompact])
  return useCallback((e: UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop
    const delta = top - last.current
    if (top < 60) setTabCompact(false)
    else if (delta > 8) setTabCompact(true)
    else if (delta < -8) setTabCompact(false)
    last.current = top
  }, [setTabCompact])
}
