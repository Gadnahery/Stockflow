import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; tone: ToastTone }

interface UiState {
  tabCompact: boolean
  setTabCompact: (v: boolean) => void
  toasts: Toast[]
  toast: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 1
export const useUi = create<UiState>((set, get) => ({
  tabCompact: false,
  setTabCompact: (v) => { if (get().tabCompact !== v) set({ tabCompact: v }) },
  toasts: [],
  toast: (message, tone = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), 2400)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
