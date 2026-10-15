import { useState } from 'react'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useBranches } from '../hooks/useBranches'
import { useUi } from '../store/uiStore'
import Sheet from './ui/Sheet'

/** Header chip: shows active branch; tap to switch without leaving POS */
export default function ActiveBranchChip() {
  const { active, branches, switchTo } = useBranches()
  const toast = useUi((s) => s.toast)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  if (!active && branches.length === 0) return null

  const pick = async (id: string) => {
    if (id === active?.id) {
      setOpen(false)
      return
    }
    setBusy(id)
    try {
      await switchTo(id)
      const name = branches.find((b) => b.id === id)?.name
      toast(name ? `Branch: ${name}` : 'Branch updated', 'success')
      setOpen(false)
    } catch {
      toast('Could not switch branch', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex items-center gap-1.5 h-8 max-w-[160px] px-2.5 rounded-full bg-black/[0.05] dark:bg-white/10 text-[12px] font-semibold text-ink-secondary"
        title="Switch branch"
      >
        <Building2 size={13} className="text-primary shrink-0" />
        <span className="truncate">{active?.name || 'Branch'}</span>
        {branches.length > 1 && <ChevronDown size={12} className="shrink-0 opacity-60" />}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Switch branch">
        <p className="text-[13px] text-ink-secondary mb-3">
          Products stay the same. New sales will be tagged to the branch you pick.
        </p>
        <div className="rounded-[18px] bg-black/[0.03] dark:bg-white/5 overflow-hidden">
          {branches.map((b, i) => {
            const isActive = b.id === active?.id
            return (
              <button
                key={b.id}
                type="button"
                disabled={busy !== null}
                onClick={() => void pick(b.id)}
                className={`press w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                  i < branches.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[13px]">
                  {(b.code || b.name).slice(0, 2).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-ink truncate">{b.name}</span>
                  {b.code && <span className="text-[12px] text-ink-muted">{b.code}</span>}
                </span>
                {busy === b.id ? (
                  <span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : isActive ? (
                  <span className="text-primary flex items-center gap-1 text-[12px] font-semibold">
                    <Check size={16} /> Active
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}
