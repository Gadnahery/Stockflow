import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  supabase,
  supabaseConfigured,
  fetchMembership,
  createBusiness as rpcCreateBusiness,
  acceptInvite as rpcAcceptInvite,
  cacheMember,
  cacheBusiness,
  getCachedMember,
  getCachedBusiness,
  clearBusinessId,
  setBusinessId,
  getBranchId,
  type BusinessMember,
  type Business,
  type Session,
  type User,
} from '../lib/supabase'
import type { Permission } from '../types'
import { switchToBusinessWorkspace } from '../lib/db'
import { canWrite as entitlementCanWrite, computeAccess } from '../lib/entitlement'
import { pullMissing } from '../lib/sync'

const PIN_LOCK_KEY = 'sf_pin_locked'
const PIN_FAIL_KEY = 'sf_pin_fails'
const LAST_ACTIVITY_KEY = 'sf_last_activity'
const DEFAULT_IDLE_MS = 5 * 60 * 1000

// Supabase persists the authenticated session in localStorage. Read it directly as a
// last-resort boot path when offline, rather than waiting indefinitely for auth hydration.
function readCachedAuthSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.endsWith('-auth-token')) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { currentSession?: Session; access_token?: string; user?: User; expires_at?: number }
      const session = parsed.currentSession ?? (parsed.access_token && parsed.user ? parsed as Session : null)
      if (session?.user && session.access_token) {
        if (session.expires_at && session.expires_at * 1000 < Date.now() && navigator.onLine) continue
        return session
      }
    }
  } catch { /* invalid or unavailable cache */ }
  return null
}

interface AuthState {
  session: Session | null
  user: User | null
  member: BusinessMember | null
  business: Business | null
  /** True until the first session + membership check finishes */
  loading: boolean
  pinLocked: boolean
  offlineMode: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ hasBusiness: boolean }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsVerification: boolean }>
  signOut: () => Promise<void>
  createBusiness: (name: string, phone?: string, address?: string) => Promise<string>
  acceptInvite: (token: string) => Promise<string>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  can: (permission: Permission) => boolean
  lockWithPin: () => void
  unlockWithPin: (pin: string) => Promise<boolean>
  refreshMembership: () => Promise<void>
  touchActivity: () => void
  canWrite: boolean
  access: ReturnType<typeof computeAccess>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mirrorSessionUser(m: BusinessMember | null) {
  if (m) {
    sessionStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: m.user_id,
        name: m.display_name || 'User',
        role: m.role,
        permissions: m.permissions || [],
        active: m.status === 'active',
      }),
    )
  } else {
    sessionStorage.removeItem('currentUser')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<BusinessMember | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinLocked, setPinLocked] = useState(false)
  const [offlineMode, setOfflineMode] = useState(!navigator.onLine)
  const booted = useRef(false)
  const userRef = useRef<User | null>(null)

  const applyMembership = useCallback(async (uid: string) => {
    try {
      const cachedMember = getCachedMember()
      const cachedBusiness = getCachedBusiness()
      const cached = cachedMember?.status === 'active' && cachedMember.user_id === uid
        ? { member: cachedMember, business: cachedBusiness?.id === cachedMember.business_id ? cachedBusiness : null }
        : null
      let result: { member: BusinessMember | null; business: Business | null }
      if (!navigator.onLine && cached) {
        result = cached
      } else if (cached) {
        // Show the last verified workspace immediately, then refresh it in the background.
        // This prevents stale trial/billing state from remaining on screen after the cloud updated.
        result = cached
        void fetchMembership(uid).then(async (fresh) => {
          if (fresh.member?.user_id !== uid) return
          await switchToBusinessWorkspace(
            fresh.member.business_id,
            getBranchId(),
            fresh.member.branch_ids?.[0] && fresh.member.branch_ids[0] === getBranchId() ? fresh.member.business_id : undefined,
          )
          setMember(fresh.member)
          setBusiness(fresh.business)
          cacheMember(fresh.member)
          cacheBusiness(fresh.business)
          mirrorSessionUser(fresh.member)
          if (fresh.member.business_id && navigator.onLine) void pullMissing().catch(() => 0)
        }).catch(() => undefined)
      } else {
        result = await fetchMembership(uid)
      }
      const { member: m, business: b } = result
      // Isolate IndexedDB per business — never show another shop's products/customers
      await switchToBusinessWorkspace(
        m?.business_id ?? null,
        getBranchId(),
        m?.branch_ids?.[0] && m.branch_ids[0] === getBranchId() ? m.business_id : undefined,
      )
      setMember(m)
      setBusiness(b)
      cacheMember(m)
      try {
      } catch { /* ignore */ }
      mirrorSessionUser(m)
      if (m?.business_id && navigator.onLine) {
        // Load ONLY this business from the cloud (empty if new shop)
        void pullMissing().catch(() => 0)
      }
      return m
    } catch (e) {
      console.warn('fetchMembership failed', e)
      await switchToBusinessWorkspace(null)
      setMember(null)
      setBusiness(null)
      return null
    }
  }, [])

  useEffect(() => {
    // Offline startup must not depend on a live Supabase client. Hydrate the
    // saved session + membership first so the local PIN screen and IndexedDB POS
    // remain available in airplane mode, including after a full app restart.
    if (!supabaseConfigured || !supabase) {
      if (!navigator.onLine) {
        const cachedSession = readCachedAuthSession()
        let cachedMember: BusinessMember | null = null
        let cachedBusiness: Business | null = null
        try { cachedMember = JSON.parse(localStorage.getItem('sf_member_cache') || 'null') } catch { /* ignore corrupt cache */ }
        try { cachedBusiness = JSON.parse(localStorage.getItem('sf_business_cache') || 'null') } catch { /* ignore corrupt cache */ }
        if (cachedSession?.user && cachedMember?.user_id === cachedSession.user.id && cachedMember.status === 'active') {
          setSession(cachedSession)
          setUser(cachedSession.user)
          userRef.current = cachedSession.user
          setMember(cachedMember)
          setBusiness(cachedBusiness?.id === cachedMember.business_id ? cachedBusiness : null)
          setOfflineMode(true)
          mirrorSessionUser(cachedMember)
          const hasPin = Boolean(localStorage.getItem('sf_device_pin'))
          setPinLocked(hasPin || localStorage.getItem(PIN_LOCK_KEY) === '1')
          if (hasPin) localStorage.setItem(PIN_LOCK_KEY, '1')
        }
      }
      setLoading(false)
      return
    }

    let mounted = true

    const boot = async () => {
      try {
        const cachedOfflineSession = !navigator.onLine ? readCachedAuthSession() : null
        const sessionRequest = supabase.auth.getSession()
        const sessionResult = cachedOfflineSession
          ? { data: { session: cachedOfflineSession } }
          : await Promise.race([
              sessionRequest,
              new Promise<{ data: { session: null } }>((resolve) => window.setTimeout(() => resolve({ data: { session: null } }), 2500)),
            ])
        if (!mounted) return
        const s = sessionResult.data.session
        setSession(s)
        setUser(s?.user ?? null)
        userRef.current = s?.user ?? null

        if (s?.user) {
          await applyMembership(s.user.id)
          // Returning user with device PIN → always ask for PIN on open
          const hasDevicePin = Boolean(localStorage.getItem('sf_device_pin'))
          if (hasDevicePin || localStorage.getItem(PIN_LOCK_KEY) === '1') {
            localStorage.setItem(PIN_LOCK_KEY, '1')
            setPinLocked(true)
          }
        } else {
          setMember(null)
          setBusiness(null)
          cacheMember(null)
          mirrorSessionUser(null)
          localStorage.setItem(PIN_LOCK_KEY, '0')
          setPinLocked(false)
        }
      } catch {
        // Never strand the user on a spinner when network/auth storage is slow.
        const cachedMember = (() => { try { return JSON.parse(localStorage.getItem('sf_member_cache') || 'null') as BusinessMember | null } catch { return null } })()
        const cachedBusiness = (() => { try { return JSON.parse(localStorage.getItem('sf_business_cache') || 'null') as Business | null } catch { return null } })()
        if (!navigator.onLine && userRef.current && cachedMember?.user_id === userRef.current.id && cachedMember.status === 'active') {
          setMember(cachedMember)
          setBusiness(cachedBusiness)
          setPinLocked(Boolean(localStorage.getItem('sf_device_pin')))
        }
      } finally {
        if (mounted) {
          booted.current = true
          setLoading(false)
        }
      }
    }

    void boot()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (!mounted) return
      // getSession() in boot() owns initial hydration; handling INITIAL_SESSION here too
      // can trigger a second network membership lookup and leave the app on a spinner.
      if (event === 'INITIAL_SESSION') return

      setSession(next)
      setUser(next?.user ?? null)
      userRef.current = next?.user ?? null

      if (next?.user) {
        await applyMembership(next.user.id)
        if (event === 'SIGNED_IN') {
          localStorage.setItem(PIN_LOCK_KEY, '0')
          setPinLocked(false)
          localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
        }
      } else {
        setMember(null)
        setBusiness(null)
        cacheMember(null)
        clearBusinessId()
        mirrorSessionUser(null)
        localStorage.setItem(PIN_LOCK_KEY, '0')
        setPinLocked(false)
      }

      if (booted.current) setLoading(false)
    })

    const onOnline = () => {
      setOfflineMode(false)
      const u = userRef.current
      if (u) void applyMembership(u.id)
    }
    const onOffline = () => setOfflineMode(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [applyMembership])

  // Idle PIN lock — only when fully in-app (session + member)
  useEffect(() => {
    if (!session || !member) return
    const tick = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now())
      if (Date.now() - last > DEFAULT_IDLE_MS) {
        localStorage.setItem(PIN_LOCK_KEY, '1')
        setPinLocked(true)
      }
    }
    const id = window.setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [session, member])

  const touchActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Auth not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    let hasBusiness = false
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
      userRef.current = data.session.user
    }
    if (data.user) {
      const m = await applyMembership(data.user.id)
      hasBusiness = Boolean(m)
    }
    localStorage.setItem(PIN_LOCK_KEY, '0')
    setPinLocked(false)
    localStorage.setItem(PIN_FAIL_KEY, '0')
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    setLoading(false)
    return { hasBusiness }
  }, [applyMembership])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Auth not configured')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    return { needsVerification: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    userRef.current = null
    setMember(null)
    setBusiness(null)
    cacheMember(null)
    clearBusinessId()
    mirrorSessionUser(null)
    localStorage.setItem(PIN_LOCK_KEY, '0')
    setPinLocked(false)
  }, [])

  const createBusiness = useCallback(async (name: string, phone?: string, address?: string) => {
    const id = await rpcCreateBusiness(name, phone, address)
    // Ensure local business id is set before membership re-fetch
    setBusinessId(id)
    const u = userRef.current
    if (u) await applyMembership(u.id)
    setLoading(false)
    return id
  }, [applyMembership])

  const acceptInvite = useCallback(async (token: string) => {
    const id = await rpcAcceptInvite(token)
    const u = userRef.current
    if (u) await applyMembership(u.id)
    return id
  }, [applyMembership])

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Auth not configured')
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error('Auth not configured')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const can = useCallback(
    (permission: Permission) => {
      if (!member) return false
      if (member.role === 'owner' || member.role === 'business_owner' || member.role === 'platform_admin') return true
      return (member.permissions || []).includes(permission)
    },
    [member],
  )

  const lockWithPin = useCallback(() => {
    if (!session || !member) return
    localStorage.setItem(PIN_LOCK_KEY, '1')
    setPinLocked(true)
  }, [session, member])

  const unlockWithPin = useCallback(
    async (pin: string) => {
      const fails = Number(localStorage.getItem(PIN_FAIL_KEY) || '0')
      if (fails >= 5) {
        const lockedUntil = Number(localStorage.getItem('sf_pin_locked_until') || '0')
        if (Date.now() < lockedUntil) return false
      }

      const expected = localStorage.getItem('sf_device_pin')
      // Must have set a device PIN; plain length check is not enough
      const ok = expected ? expected === simpleHash(pin) : false

      if (!ok) {
        const next = fails + 1
        localStorage.setItem(PIN_FAIL_KEY, String(next))
        if (next >= 5) {
          localStorage.setItem('sf_pin_locked_until', String(Date.now() + 5 * 60 * 1000))
        }
        return false
      }

      localStorage.setItem(PIN_FAIL_KEY, '0')
      localStorage.setItem(PIN_LOCK_KEY, '0')
      setPinLocked(false)
      touchActivity()
      return true
    },
    [touchActivity],
  )

  const refreshMembership = useCallback(async () => {
    const u = userRef.current
    if (u) await applyMembership(u.id)
  }, [applyMembership])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      member,
      business,
      loading,
      pinLocked: Boolean(session && member && pinLocked),
      offlineMode,
      signIn,
      signUp,
      signOut,
      createBusiness,
      canWrite: entitlementCanWrite(business),
      access: computeAccess(business),
      acceptInvite,
      resetPassword,
      updatePassword,
      can,
      lockWithPin,
      unlockWithPin,
      refreshMembership,
      touchActivity,
    }),
    [
      session, user, member, business, loading, pinLocked, offlineMode,
      signIn, signUp, signOut, createBusiness, acceptInvite, resetPassword,
      updatePassword, can, lockWithPin, unlockWithPin, refreshMembership, touchActivity,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function simpleHash(pin: string): string {
  let h = 0
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) | 0
  return `local:${h}`
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function setDevicePin(pin: string) {
  localStorage.setItem('sf_device_pin', simpleHash(pin))
}
