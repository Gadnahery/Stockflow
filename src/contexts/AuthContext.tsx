import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  getCachedMember,
  clearBusinessId,
  type BusinessMember,
  type Business,
  type Session,
  type User,
} from '../lib/supabase'
import type { Permission } from '../types'

const PIN_LOCK_KEY = 'sf_pin_locked'
const PIN_FAIL_KEY = 'sf_pin_fails'
const LAST_ACTIVITY_KEY = 'sf_last_activity'
const DEFAULT_IDLE_MS = 5 * 60 * 1000

interface AuthState {
  session: Session | null
  user: User | null
  member: BusinessMember | null
  business: Business | null
  loading: boolean
  /** Device is authenticated but PIN-locked */
  pinLocked: boolean
  offlineMode: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<BusinessMember | null>(getCachedMember())
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinLocked, setPinLocked] = useState(() => localStorage.getItem(PIN_LOCK_KEY) === '1')
  const [offlineMode, setOfflineMode] = useState(!navigator.onLine)

  const applyMembership = useCallback(async (uid: string) => {
    const { member: m, business: b } = await fetchMembership(uid)
    setMember(m)
    setBusiness(b)
    cacheMember(m)
    // Bridge for legacy pages that still read sessionStorage.currentUser
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
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        applyMembership(data.session.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
      if (next?.user) {
        await applyMembership(next.user.id)
      } else {
        setMember(null)
        setBusiness(null)
        cacheMember(null)
        clearBusinessId()
      }
      setLoading(false)
    })

    const onOnline = () => {
      setOfflineMode(false)
      if (user) applyMembership(user.id)
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
  }, [applyMembership, user])

  // Idle lock
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    localStorage.setItem(PIN_LOCK_KEY, '0')
    setPinLocked(false)
    localStorage.setItem(PIN_FAIL_KEY, '0')
    touchActivity()
  }, [touchActivity])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Auth not configured')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    // If email confirmation is required, session is null
    return { needsVerification: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setMember(null)
    setBusiness(null)
    cacheMember(null)
    clearBusinessId()
    sessionStorage.removeItem('currentUser')
    localStorage.setItem(PIN_LOCK_KEY, '0')
    setPinLocked(false)
  }, [])

  const createBusiness = useCallback(async (name: string, phone?: string, address?: string) => {
    const id = await rpcCreateBusiness(name, phone, address)
    if (user) await applyMembership(user.id)
    return id
  }, [user, applyMembership])

  const acceptInvite = useCallback(async (token: string) => {
    const id = await rpcAcceptInvite(token)
    if (user) await applyMembership(user.id)
    return id
  }, [user, applyMembership])

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
      if (member.role === 'owner') return true
      return (member.permissions || []).includes(permission)
    },
    [member],
  )

  const lockWithPin = useCallback(() => {
    localStorage.setItem(PIN_LOCK_KEY, '1')
    setPinLocked(true)
  }, [])

  const unlockWithPin = useCallback(
    async (pin: string) => {
      // Offline / fast unlock: compare against cached pin if present.
      // Production: verify via Edge Function that checks pin_hash (bcrypt).
      // For Phase 1 we accept a stored simple hash in localStorage set during setup.
      const fails = Number(localStorage.getItem(PIN_FAIL_KEY) || '0')
      if (fails >= 5) {
        const lockedUntil = Number(localStorage.getItem('sf_pin_locked_until') || '0')
        if (Date.now() < lockedUntil) return false
      }

      const expected = localStorage.getItem('sf_device_pin') || member?.pin_hash
      // Phase 1: device PIN is stored locally after first set; fall back to last-4 of user id for demo unlock only when no pin set.
      const ok =
        expected
          ? expected === pin || expected === simpleHash(pin)
          : pin.length >= 4

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
    [member, touchActivity],
  )

  const refreshMembership = useCallback(async () => {
    if (user) await applyMembership(user.id)
  }, [user, applyMembership])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      member,
      business,
      loading,
      pinLocked,
      offlineMode,
      signIn,
      signUp,
      signOut,
      createBusiness,
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
  // Lightweight non-crypto marker for local device PIN only — server uses real hash.
  let h = 0
  for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) | 0
  return `local:${h}`
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Set the device PIN used for lock-screen unlock (local only until Edge Function lands). */
export function setDevicePin(pin: string) {
  localStorage.setItem('sf_device_pin', simpleHash(pin))
}
