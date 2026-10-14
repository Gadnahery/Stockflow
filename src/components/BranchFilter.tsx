import { Building2 } from 'lucide-react'
import { useBranches } from '../hooks/useBranches'

type Props = {
  /** 'all' | branch uuid */
  value: string
  onChange: (id: string) => void
  /** Show "All branches" for owners/managers */
  allowAll?: boolean
  className?: string
}

/** Compact branch chips for reports / sales / dashboard */
export default function BranchFilter({ value, onChange, allowAll = true, className = '' }: Props) {
  const { branches, loading } = useBranches()

  if (loading || branches.length === 0) return null
  if (branches.length === 1 && !allowAll) return null

  return (
    <div className={`flex gap-2 overflow-x-auto no-scrollbar pb-1 ${className}`}>
      {allowAll && branches.length > 1 && (
        <button
          type="button"
          onClick={() => onChange('all')}
          className={`press shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border ${
            value === 'all'
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-ink-secondary border-border'
          }`}
        >
          All branches
        </button>
      )}
      {branches.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onChange(b.id)}
          className={`press shrink-0 h-8 px-3 rounded-full text-[13px] font-semibold border flex items-center gap-1.5 ${
            value === b.id
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-ink-secondary border-border'
          }`}
        >
          <Building2 size={13} />
          {b.name}
        </button>
      ))}
    </div>
  )
}
