import { Link } from 'react-router-dom'
import { Building2, ChevronDown } from 'lucide-react'
import { useBranches } from '../hooks/useBranches'

/** Header chip: shows active branch; tap to manage branches */
export default function ActiveBranchChip() {
  const { active, branches } = useBranches()
  if (!active && branches.length === 0) return null

  return (
    <Link
      to="/branches"
      className="press inline-flex items-center gap-1.5 h-8 max-w-[160px] px-2.5 rounded-full bg-black/[0.05] text-[12px] font-semibold text-ink-secondary"
      title="Switch branch"
    >
      <Building2 size={13} className="text-primary shrink-0" />
      <span className="truncate">{active?.name || 'Branch'}</span>
      {branches.length > 1 && <ChevronDown size={12} className="shrink-0 opacity-60" />}
    </Link>
  )
}
