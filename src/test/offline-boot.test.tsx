/**
 * End-to-end offline test (simulated browser): the installed app is closed, the phone goes offline,
 * the app is opened again → PIN screen → unlock → products visible → add a product and complete a
 * sale with no network → everything is queued for sync later.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const BIZ = 'a0000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co') // production-like: client configured
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }) // airplane mode
  vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch') })
  localStorage.clear(); sessionStorage.clear()
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('offline: reopen the installed app', () => {
  it('PIN screen → unlock → products → new product → sale, all without network', async () => {
    const { db } = await import('../lib/db')
    const { setDevicePin } = await import('../contexts/AuthContext')

    // ---- state left on the phone from earlier online use ----
    const user = { id: 'u1', email: 'owner@shop.tz' }
    localStorage.setItem('sb-test-auth-token', JSON.stringify({
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) - 3600, user,
    })) // access token already expired: the shop has been offline for hours
    localStorage.setItem('sf_member_cache', JSON.stringify({
      id: 'm1', business_id: BIZ, user_id: 'u1', role: 'owner', permissions: [], branch_ids: [], status: 'active', display_name: 'Shop Owner',
    }))
    localStorage.setItem('sf_business_cache', JSON.stringify({
      id: BIZ, name: 'Test Shop', subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 5 * 864e5).toISOString(), paid_until: null,
    }))
    localStorage.setItem('sf_workspace_id', `${BIZ}:shared`)
    setDevicePin('4321')
    const now = new Date().toISOString()
    await db.products.add({ id: 'c0000000-0000-4000-8000-0000000000e1', name: 'Eggs Tray', sku: 'EGG-1', price: 9500, cost: 8000, stock: 10, active: true, createdAt: now, updatedAt: now })

    // ---- open the app ----
    const { default: App } = await import('../App')
    const { AuthProvider } = await import('../contexts/AuthContext')
    const { I18nProvider } = await import('../i18n/I18nContext')
    const { ConfirmProvider } = await import('../components/ui/ConfirmDialog')
    render(
      <MemoryRouter initialEntries={['/pos']}>
        <I18nProvider><AuthProvider><ConfirmProvider><App /></ConfirmProvider></AuthProvider></I18nProvider>
      </MemoryRouter>,
    )

    // 1. PIN pad is shown (not a blank/white screen, not a login redirect)
    await waitFor(() => expect(screen.getByText('Enter PIN to unlock')).toBeTruthy(), { timeout: 8000 })
    expect(screen.getByText('Shop Owner')).toBeTruthy()

    // 2. wrong PIN is rejected, right PIN unlocks
    for (const d of '9999') fireEvent.click(screen.getByRole('button', { name: d }))
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    expect(screen.queryByText('Enter PIN to unlock')).toBeTruthy()
    for (const d of '4321') fireEvent.click(screen.getByRole('button', { name: d }))

    // 3. POS opens with the locally stored catalogue
    await waitFor(() => expect(screen.getByText('Eggs Tray')).toBeTruthy(), { timeout: 8000 })

    // 4. work offline: add a product, then sell
    const id2 = 'c0000000-0000-4000-8000-0000000000e2'
    await db.products.add({ id: id2, name: 'Single Egg', sku: 'EGG-2', price: 350, cost: 267, stock: 30, active: true, createdAt: now, updatedAt: now })
    const { usePosStore } = await import('../store/posStore')
    const store = usePosStore.getState()
    const egg = (await db.products.get(id2))!
    store.addToCart(egg); store.addToCart(egg)
    const sale = await usePosStore.getState().completeSale([{ method: 'cash', amount: 700 }])
    expect(sale.total).toBe(700)
    expect((await db.products.get(id2))!.stock).toBe(28)

    // 5. everything is waiting in the outbox for when the network returns
    await new Promise((r) => setTimeout(r, 50))
    const queued = (await db.outbox.toArray()).map((e) => e.type)
    expect(queued).toContain('sale')
    expect(queued).toContain('product_upsert')
  })
})
