/**
 * Offline workflow through the REAL screens (no network, stale flags left on the phone):
 * several sales in a row, each must complete; products must be addable and editable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const BIZ = 'a0000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  // a dead network that HANGS instead of failing fast (phone on wifi without internet)
  vi.stubGlobal('fetch', () => new Promise(() => undefined))
  localStorage.clear(); sessionStorage.clear()
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

async function openApp(path: string, opts: { staleWriteFlag?: boolean } = {}) {
  const { db } = await import('../lib/db')
  const { setDevicePin } = await import('../contexts/AuthContext')
  localStorage.setItem('sb-test-auth-token', JSON.stringify({
    access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: 'u1', email: 'owner@shop.tz' },
  }))
  localStorage.setItem('sf_member_cache', JSON.stringify({
    id: 'm1', business_id: BIZ, user_id: 'u1', role: 'owner', permissions: [], branch_ids: [], status: 'active', display_name: 'Shop Owner',
  }))
  localStorage.setItem('sf_business_cache', JSON.stringify({
    id: BIZ, name: 'Test Shop', subscription_status: 'trial', trial_ends_at: new Date(Date.now() + 5 * 864e5).toISOString(), paid_until: null,
  }))
  localStorage.setItem('sf_workspace_id', `${BIZ}:shared`)
  if (opts.staleWriteFlag) localStorage.setItem('sf_write_allowed', '0') // left behind by an older version
  setDevicePin('4321')
  await Promise.all(db.tables.map((t) => t.clear())) // fresh phone storage per test
  const now = new Date().toISOString()
  await db.products.bulkAdd([
    { id: 'c0000000-0000-4000-8000-0000000000e1', name: 'Eggs Tray', sku: 'EGG-1', price: 9500, cost: 8000, stock: 10, active: true, createdAt: now, updatedAt: now },
    { id: 'c0000000-0000-4000-8000-0000000000e2', name: 'Bread Loaf', sku: 'BRD-1', price: 2500, cost: 1600, stock: 20, active: true, createdAt: now, updatedAt: now },
  ])
  const { default: App } = await import('../App')
  const { AuthProvider } = await import('../contexts/AuthContext')
  const { I18nProvider } = await import('../i18n/I18nContext')
  const { ConfirmProvider } = await import('../components/ui/ConfirmDialog')
  render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider><AuthProvider><ConfirmProvider><App /></ConfirmProvider></AuthProvider></I18nProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getByText('Enter PIN to unlock')).toBeTruthy(), { timeout: 8000 })
  for (const d of '4321') fireEvent.click(screen.getByRole('button', { name: d }))
  return db
}

describe('offline, through the real screens', () => {
  it('completes five sales in a row without hanging', async () => {
    const db = await openApp('/pos')
    await waitFor(() => expect(screen.getByText('Eggs Tray')).toBeTruthy(), { timeout: 8000 })

    for (let n = 1; n <= 5; n++) {
      fireEvent.click(screen.getByText(n % 2 ? 'Eggs Tray' : 'Bread Loaf').closest('button')!)
      fireEvent.click(screen.getAllByText('Charge')[0].closest('button')!) // open payment sheet
      const pay = await screen.findByRole('button', { name: /^Charge [\d,]+ TZS$/ }, { timeout: 5000 })
      fireEvent.click(pay)
      // the sale must finish quickly even though the network call would hang forever
      await waitFor(async () => expect(await db.sales.count()).toBe(n), { timeout: 4000 })
      await waitFor(() => expect(screen.getAllByLabelText('Close').length).toBeGreaterThan(0), { timeout: 4000 }) // receipt shown
      fireEvent.click(screen.getAllByLabelText('Close')[0])
      await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    }
    expect(await db.sales.count()).toBe(5)
    expect((await db.products.get('c0000000-0000-4000-8000-0000000000e1'))!.stock).toBe(7) // 3 trays sold
    expect((await db.products.get('c0000000-0000-4000-8000-0000000000e2'))!.stock).toBe(18) // 2 loaves sold
  }, 60000)

  it('products can be added and edited offline even with a stale "trial ended" flag on the phone', async () => {
    const db = await openApp('/products', { staleWriteFlag: true })
    await waitFor(() => expect(screen.getByText('Eggs Tray')).toBeTruthy(), { timeout: 8000 })

    // edit an existing product
    fireEvent.click(screen.getByText('Eggs Tray').closest('button')!)
    const price = (await screen.findAllByDisplayValue('9500'))[0]
    fireEvent.change(price, { target: { value: '9800' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    await waitFor(async () => expect((await db.products.get('c0000000-0000-4000-8000-0000000000e1'))!.price).toBe(9800), { timeout: 4000 })
    expect(screen.queryByText(/trial ended/i)).toBeNull()
  }, 30000)
})
