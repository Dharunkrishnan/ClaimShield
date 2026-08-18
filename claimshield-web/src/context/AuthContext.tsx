
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { RoleIdValue } from '../lib/roles'
import { RoleName } from '../lib/roles'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  roleId: RoleIdValue | null
  roleName: string | null
  displayName: string
  otpVerified: boolean
  markOtpVerified: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const OTP_VERIFIED_KEY = 'claimshield_otp_verified_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [otpVerified, setOtpVerified] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)

      if (data.session?.user?.id) {
        const verifiedUser = sessionStorage.getItem(OTP_VERIFIED_KEY)

        setOtpVerified(verifiedUser === data.session.user.id)
      } else {
        setOtpVerified(false)
      }

      setLoading(false)
    })

    const {
      data: subscription,
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)

      if (!newSession?.user?.id) {
        sessionStorage.removeItem(OTP_VERIFIED_KEY)
        setOtpVerified(false)
        return
      }

      const verifiedUser = sessionStorage.getItem(OTP_VERIFIED_KEY)

      setOtpVerified(verifiedUser === newSession.user.id)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const markOtpVerified = () => {
    if (!session?.user?.id) {
      return
    }

    sessionStorage.setItem(OTP_VERIFIED_KEY, session.user.id)
    setOtpVerified(true)
  }

  const roleId =
    (session?.user.user_metadata?.role_id as RoleIdValue | undefined) ?? null

  const value: AuthContextValue = {
    session,
    loading,
    roleId,
    roleName: roleId ? RoleName[roleId] : null,

    displayName:
      [
        session?.user.user_metadata?.first_name,
        session?.user.user_metadata?.last_name,
      ]
        .filter(Boolean)
        .join(' ') ||
      session?.user.email ||
      'User',

    otpVerified,
    markOtpVerified,

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      return {
        error: error?.message ?? null,
      }
    },

    signOut: async () => {
      sessionStorage.removeItem(OTP_VERIFIED_KEY)
      setOtpVerified(false)

      await supabase.auth.signOut()
      setSession(null)
    },
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
