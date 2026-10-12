import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; tone: ToastTone }

export type SidebarMode = 'expanded' | 'rail' | 'hidden'

const SIDEBAR_KEY = 'sf_sidebar_mode'

function readSidebar(): SidebarMode {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY)
    if (v === 'expanded' || v === 'rail' || v === 'hidden') return v
  } catch { /* ignore */ }
  return 'expanded'
}

interface UiState {
  tabCompact: boolean
  tabHidden: boolean
  setTabHidden: (v: boolean) => void
  setTabCompact: (v: boolean) => void
  sidebarMode: SidebarMode
  setSidebarMode: (m: SidebarMode) => void
  cycleSidebar: () => void
  commandOpen: boolean
  setCommandOpen: (v: boolean) => void
  toasts: Toast[]
  toast: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 1
export const useUi = create<UiState>((set, get) => ({
  tabCompact: false,
  tabHidden: false,
  setTabHidden: (v) => { if (get().tabHidden !== v) set({ tabHidden: v }) },
  setTabCompact: (v) => { if (get().tabCompact !== v) set({ tabCompact: v }) },
  sidebarMode: typeof window !== 'undefined' ? readSidebar() : 'expanded',
  setSidebarMode: (m) => {
    try { localStorage.setItem(SIDEBAR_KEY, m) } catch { /* ignore */ }
    set({ sidebarMode: m })
  },
  cycleSidebar: () => {
    const order: SidebarMode[] = ['expanded', 'rail', 'hidden']
    const i = order.indexOf(get().sidebarMode)
    const next = order[(i + 1) % order.length]
    get().setSidebarMode(next)
  },
  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
  toasts: [],
  toast: (message, tone = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), 2400)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
