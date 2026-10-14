/**
 * Smoke test: opens every screen as a signed-in owner and fails if any of them crashes
 * (the class of bug that shows "Something went wrong — t is not defined").
 * Run: npm run test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('../contexts/AuthContext', async () => {
  const { computeAccess } = await import('../lib/entitlement')
  const business = {
    id: 'a0000000-0000-4000-8000-000000000001', name: 'Test Shop', subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 10 * 864e5).toISOString(), paid_until: null,
  }
  const member = {
    id: 'm1', business_id: business.id, user_id: 'u1', role: 'owner', permissions: [], branch_ids: [], status: 'active', display_name: 'Owner',
  }
  const value = {
    session: { access_token: 'x' }, user: { id: 'u1', email: 'owner@test.com' }, member, business,
    loading: false, pinLocked: false, offlineMode: false, canWrite: true, access: computeAccess(business as never),
    signIn: async () => ({ hasBusiness: true }), signUp: async () => ({ needsVerification: false }), signOut: async () => undefined,
    createBusiness: async () => 'id', acceptInvite: async () => 'id', resetPassword: async () => undefined, updatePassword: async () => undefined,
    can: () => true, lockWithPin: () => undefined, unlockWithPin: async () => true, refreshMembership: async () => undefined, touchActivity: () => undefined,
  }
  return { AuthProvider: ({ children }: { children: ReactNode }) => children, useAuth: () => value, setDevicePin: () => undefined }
})

import App from '../App'
import { I18nProvider } from '../i18n/I18nContext'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'
import ErrorBoundary from '../components/ErrorBoundary'

const ROUTES = [
  '/', '/login', '/signup', '/forgot-password', '/reset-password', '/accept-invite',
  '/features', '/pricing', '/about', '/contact', '/privacy', '/terms', '/resources',
  '/pos', '/home', '/notifications', '/products', '/customers', '/reports', '/sales', '/more', '/settings',
  '/shifts', '/expenses', '/suppliers', '/stock', '/tables', '/users', '/export', '/import', '/sync', '/audit',
  '/account', '/billing', '/branches', '/help', '/does-not-exist',
]

describe('every screen renders without crashing', () => {
  for (const path of ROUTES) {
    it(path, async () => {
      const errors: string[] = []
      const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a.map(String).join(' ')) })
      sessionStorage.setItem('currentUser', JSON.stringify({ id: 'u1', name: 'Owner', role: 'owner', permissions: [], active: true }))
      render(
        <ErrorBoundary>
          <MemoryRouter initialEntries={[path]}>
            <I18nProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </I18nProvider>
          </MemoryRouter>
        </ErrorBoundary>,
      )
      // let effects, Dexie seeding and live queries settle
      await act(async () => { await new Promise((r) => setTimeout(r, 400)) })
      const text = document.body.textContent || ''
      const crashed = text.includes('Something went wrong')
      if (crashed) console.log(`CRASH on ${path}:`, text.slice(text.indexOf('Go to sign in'), text.indexOf('Go to sign in') + 120))
      spy.mockRestore()
      cleanup()
      expect(crashed, `"${path}" crashed — ${errors.find((e) => /ReferenceError|TypeError|Error:/.test(e))?.slice(0, 300) ?? 'see console'}`).toBe(false)
    })
  }
})
