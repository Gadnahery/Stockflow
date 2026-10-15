import { useEffect, useState } from 'react'
import { Building2, Plus, Check } from 'lucide-react'
import Screen from '../components/ui/Screen'
import Sheet from '../components/ui/Sheet'
import { useAuth } from '../contexts/AuthContext'
import { usePermission } from '../hooks/usePermission'
import { useUi } from '../store/uiStore'
import { supabase, getBusinessId } from '../lib/supabase'
import { setActiveBranchId } from '../lib/branch'
import { db } from '../lib/db'
import { useI18n } from '../i18n/I18nContext'

type BranchRow = {
  id: string
  name: string
  code: string | null
  business_id: string
}

export default function BranchesPage() {
  const { member, business, refreshMembership } = useAuth()
  const { locale } = useI18n()
  const sw = locale === 'sw'
  const { can } = usePermission()
  const toast = useUi((s) => s.toast)
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const activeId = localStorage.getItem('branchId')

  const canManage = can('MANAGE_SETTINGS') || member?.role === 'business_owner' || member?.role === 'owner'

  const load = async () => {
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, code, business_id')
      .eq('business_id', bizId)
      .order('name')
    if (error) toast(error.message, 'error')
    setBranches((data as BranchRow[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [member?.business_id])

  const create = async () => {
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase || !name.trim()) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('branches')
        .insert({
          business_id: bizId,
          name: name.trim(),
          code: (code.trim() || name.trim().slice(0, 4)).toUpperCase(),
        })
        .select('id, name, code, business_id')
        .single()
      if (error) throw error
      // Keep the owner's permitted branch list in sync so the selection survives reloads.
      if (member?.id && (member.role === 'business_owner' || member.role === 'owner')) {
        const nextIds = Array.from(new Set([...(member.branch_ids || []), data.id]))
        const { error: memberUpdateError } = await supabase.from('business_members').update({ branch_ids: nextIds }).eq('id', member.id)
        if (memberUpdateError) throw memberUpdateError
        await refreshMembership()
      }
      await db.branches.put({
        id: data.id,
        name: data.name,
        active: true,
      })
      setShow(false)
      setName('')
      setCode('')
      toast(sw ? 'Tawi limeundwa' : 'Branch created', 'success')
      await load()
    } catch (e) {
      toast((e as Error).message || (sw ? 'Imeshindikana kuunda tawi' : 'Could not create branch'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const setActive = async (id: string) => {
    // Lightweight switch: only change active branch tag.
    // Do NOT call switchToBusinessWorkspace — that is for changing shops, not branches,
    // and must never clear the shared product catalogue.
    try {
      setActiveBranchId(id)
      try {
        await db.settings.update('main', { branchId: id } as Record<string, unknown>)
      } catch {
        /* settings row optional */
      }
      window.dispatchEvent(new Event('sf-branch-change'))
      setBranches((b) => [...b])
      toast(sw ? 'Tawi linalotumika limebadilishwa' : 'Active branch updated', 'success')
    } catch {
      toast(sw ? 'Imeshindikana kubadilisha tawi' : 'Could not switch branch', 'error')
    }
  }

  return (
    <Screen
      title={sw ? 'Matawi' : 'Branches'}
      subtitle={business?.name || (sw ? 'Maeneo' : 'Locations')}
      action={
        canManage ? (
          <button
            type="button"
            onClick={() => setShow(true)}
            className="press h-9 px-3.5 rounded-full bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5"
          >
            <Plus size={16} /> {sw ? 'Ongeza' : 'Add'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4 md:max-w-lg pb-6">
        <p className="text-[14px] text-ink-secondary px-1">
           {sw ? 'Orodha ya bidhaa inashirikishwa kati ya matawi yote. Mauzo na gharama hubaki kwenye tawi yalipotokea.' : 'The product catalogue is shared across all branches. Sales and expenses remain assigned to the branch where they happen.'}
        </p>

        {loading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-[16px] bg-white shadow-card skeleton" />
            ))}
          </div>
        )}

        {!loading && branches.length === 0 && (
          <div className="rounded-[22px] bg-white shadow-card px-6 py-10 text-center">
            <Building2 className="mx-auto text-ink-muted" size={28} />
            <p className="mt-3 text-[16px] font-semibold">{sw ? 'Bado hakuna matawi' : 'No branches yet'}</p>
            <p className="text-[14px] text-ink-secondary mt-1">{sw ? 'Unda tawi kuu au ongeza eneo jingine.' : 'Create Main or add another location.'}</p>
          </div>
        )}

        {!loading && branches.length > 0 && (
          <div className="bg-white rounded-[22px] shadow-card overflow-hidden">
            {branches.map((b, i) => {
              const active = activeId === b.id || (!activeId && i === 0)
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActive(b.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                    i < branches.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <span className="h-10 w-10 rounded-[12px] bg-primary/10 text-primary flex items-center justify-center">
                    <Building2 size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold">{b.name}</span>
                    <span className="block text-[12px] text-ink-muted">{b.code || '—'}</span>
                  </span>
                  {active && (
                    <span className="text-success flex items-center gap-1 text-[13px] font-semibold">
                      <Check size={16} /> {sw ? 'Linalotumika' : 'Active'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Sheet
        open={show}
        onClose={() => setShow(false)}
        title={sw ? 'Tawi jipya' : 'New branch'}
        footer={
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void create()}
            className="press w-full h-12 rounded-[14px] bg-primary text-white font-semibold disabled:opacity-50"
          >
            {busy ? (sw ? 'Inaandaa…' : 'Creating…') : (sw ? 'Unda tawi' : 'Create branch')}
          </button>
        }
      >
        <div className="space-y-3.5">
          <div>
            <label className="auth-label">{sw ? 'Jina' : 'Name'}</label>
            <input className="field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kariakoo branch" />
          </div>
          <div>
            <label className="auth-label">{sw ? 'Kodi' : 'Code'}</label>
            <input className="field w-full" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. KAR" />
          </div>
        </div>
      </Sheet>
    </Screen>
  )
}
