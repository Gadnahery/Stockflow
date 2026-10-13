import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/ui/Screen'
import { useI18n } from '../i18n/I18nContext'
import { useUi } from '../store/uiStore'
import { featuresFor } from '../lib/industry'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

type TableStatus = 'free' | 'occupied' | 'bill'
type TableRow = { id: string; name: string; seats: number; status: TableStatus; note?: string }

const KEY = 'sf_restaurant_tables'

function loadTables(): TableRow[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as TableRow[]
  } catch {
    /* ignore */
  }
  return [
    { id: 't1', name: 'T1', seats: 2, status: 'free' },
    { id: 't2', name: 'T2', seats: 2, status: 'free' },
    { id: 't3', name: 'T3', seats: 4, status: 'free' },
    { id: 't4', name: 'T4', seats: 4, status: 'free' },
    { id: 't5', name: 'T5', seats: 6, status: 'free' },
    { id: 't6', name: 'T6', seats: 6, status: 'free' },
  ]
}

function saveTables(rows: TableRow[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
}

export default function RestaurantTablesPage() {
  const { locale } = useI18n()
  const sw = locale === 'sw'
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const feats = featuresFor(settings?.industryType)
  const [tables, setTables] = useState<TableRow[]>(loadTables)

  useEffect(() => {
    saveTables(tables)
  }, [tables])

  if (!feats.tables) {
    return (
      <Screen title={sw ? 'Meza' : 'Tables'} subtitle={sw ? 'Moduli ya mgahawa' : 'Restaurant module'}>
        <div className="p-6 text-[15px] text-ink-secondary">
          {sw
            ? 'Washa aina ya biashara “Mgahawa” kwenye Mipangilio ili kutumia meza.'
            : 'Set shop type to Restaurant in Settings to use tables.'}
        </div>
      </Screen>
    )
  }

  const cycle = (id: string) => {
    setTables((rows) =>
      rows.map((t) => {
        if (t.id !== id) return t
        const next: TableStatus =
          t.status === 'free' ? 'occupied' : t.status === 'occupied' ? 'bill' : 'free'
        return { ...t, status: next }
      }),
    )
  }

  const openSale = (t: TableRow) => {
    localStorage.setItem('sf_active_table', t.name)
    toast(sw ? `Meza ${t.name} — fungua POS` : `Table ${t.name} — open POS`, 'info')
    navigate('/pos')
  }

  const color = (s: TableStatus) =>
    s === 'free' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
    s === 'occupied' ? 'bg-amber-50 border-amber-200 text-amber-900' :
    'bg-primary/10 border-primary/30 text-primary'

  return (
    <Screen title={sw ? 'Meza' : 'Tables'} subtitle={sw ? 'Mpango wa sakafu' : 'Floor plan'}>
      <div className="px-4 pb-8 md:max-w-2xl space-y-4">
        <p className="text-[13px] text-ink-muted">
          {sw
            ? 'Gusa meza kubadilisha hali. Fungua mauzo kwa meza iliyochaguliwa.'
            : 'Tap a table to cycle status. Open a sale for the selected table.'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tables.map((t) => (
            <div key={t.id} className={`rounded-[18px] border p-4 ${color(t.status)}`}>
              <button type="button" className="w-full text-left" onClick={() => cycle(t.id)}>
                <p className="text-[20px] font-bold">{t.name}</p>
                <p className="text-[12px] opacity-80">
                  {t.seats} {sw ? 'viti' : 'seats'} · {t.status}
                </p>
              </button>
              <button
                type="button"
                onClick={() => openSale(t)}
                className="press mt-3 w-full h-9 rounded-full bg-white/80 text-[13px] font-semibold"
              >
                {sw ? 'Uza' : 'Sell'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  )
}
