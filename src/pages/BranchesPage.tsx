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
import { getCatalogMode, setCatalogMode, type CatalogMode } from '../lib/catalogMode'
import { checkCanAdd, DEFAULT_PLAN_LIMITS } from '../lib/planLimits'
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
  const [catalogMode, setCatalogModeState] = useState<CatalogMode>('shared')
  const [modeBusy, setModeBusy] = useState(false)
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
    void getCatalogMode().then(setCatalogModeState)
  }, [member?.business_id])

  const changeCatalogMode = async (mode: CatalogMode) => {
    if (mode === catalogMode || modeBusy) return
    setModeBusy(true)
    try {
      await setCatalogMode(mode, { assignToBranchId: localStorage.getItem('branchId') })
      setCatalogModeState(mode)
      window.dispatchEvent(new Event('sf-catalog-mode'))
      window.dispatchEvent(new Event('sf-branch-change'))
      toast(
        mode === 'isolated'
          ? (sw
              ? 'Kila tawi lina bidhaa zake. Tawi jipya litaonekana tupu hadi uunde bidhaa.'
              : 'Each branch has its own products. A branch with no products shows empty until you add some.')
          : (sw
              ? 'Bidhaa zote zimeunganishwa — matawi yote yanaona orodha moja.'
              : 'All products merged — every branch sees one shared list.'),
        'success',
      )
    } catch (e) {
      toast((e as Error).message || 'Could not update catalogue mode', 'error')
    } finally {
      setModeBusy(false)
    }
  }

  const create = async () => {
    const bizId = getBusinessId() || member?.business_id
    if (!bizId || !supabase || !name.trim()) return
    // Default soft limits offline; billing page holds the real plan.
    // Pro-style: never hard-block beyond 5 if they already have many (grandfather).
    let plan = DEFAULT_PLAN_LIMITS.starter
    try {
      const code = localStorage.getItem('sf_plan_code') || 'starter'
      plan = DEFAULT_PLAN_LIMITS[code] || DEFAULT_PLAN_LIMITS.starter
    } catch { /* starter */ }
    const gate = checkCanAdd('branch', branches.length, plan)
    if (!gate.allowed) {
      toast(sw ? gate.messageSw : gate.messageEn, 'error')
      return
    }
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

        {canManage && branches.length > 0 && (
          <div className="rounded-[22px] bg-white dark:bg-[var(--card)] shadow-card p-4 space-y-3">
            <div>
              <p className="text-[15px] font-semibold text-ink">{sw ? 'Orodha ya bidhaa kati ya matawi' : 'Product catalogue across branches'}</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">
                {sw
                  ? 'Chagua kama matawi yote yanaona bidhaa zile zile, au kila tawi lina orodha yake (kama duka la pili). Unaweza kuunganisha baadaye.'
                  : 'Choose one shared product list for every branch, or a separate list per branch (like a second shop). You can merge later.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={modeBusy}
                onClick={() => void changeCatalogMode('shared')}
                className={`press text-left rounded-[16px] px-3.5 py-3 border ${
                  catalogMode === 'shared' ? 'border-primary bg-primary/10' : 'border-border bg-black/[0.02] dark:bg-white/5'
                }`}
              >
                <span className="block text-[14px] font-semibold text-ink">{sw ? 'Orodha moja (iliyounganishwa)' : 'Shared catalogue (merged)'}</span>
                <span className="block text-[12px] text-ink-secondary mt-0.5">
                  {sw ? 'Matawi yote yanaona bidhaa zile zile. Kubadilisha hapa huunganisha orodha zote.' : 'Every branch sees the same products. Switching here merges all branch lists into one.'}
                </span>
              </button>
              <button
                type="button"
                disabled={modeBusy}
                onClick={() => void changeCatalogMode('isolated')}
                className={`press text-left rounded-[16px] px-3.5 py-3 border ${
                  catalogMode === 'isolated' ? 'border-primary bg-primary/10' : 'border-border bg-black/[0.02] dark:bg-white/5'
                }`}
              >
                <span className="block text-[14px] font-semibold text-ink">{sw ? 'Orodha tofauti kwa kila tawi' : 'Separate catalogue per branch'}</span>
                <span className="block text-[12px] text-ink-secondary mt-0.5">
                  {sw ? 'Kila tawi lina bidhaa zake na hifadhi yake. Tawi bila bidhaa litaonekana tupu.' : 'Each branch has its own products and stock. An empty branch stays empty until you add products there.'}
                </span>
              </button>
            </div>
            {modeBusy && <p className="text-[12px] text-ink-muted">{sw ? 'Inasasisha…' : 'Updating…'}</p>}
          </div>
        )}

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
