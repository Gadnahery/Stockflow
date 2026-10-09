import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useUi } from '../../store/uiStore'

export default function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div
      className="fixed inset-x-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4"
      style={{ top: 'calc(var(--safe-top) + 12px)' }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertCircle : Info
        const color = t.tone === 'success' ? 'text-success' : t.tone === 'error' ? 'text-danger' : 'text-primary'
        return (
          <div key={t.id} className="toast-in glass flex items-center gap-2.5 rounded-full pl-3 pr-4 py-2.5 shadow-float border border-white/60 max-w-full">
            <Icon size={18} className={`${color} shrink-0`} />
            <span className="text-[14px] font-medium text-ink truncate">{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
