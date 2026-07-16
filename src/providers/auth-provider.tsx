import { getSession, signInAnonymously, signOut } from '@/lib/supabase/auth'
import { supabase } from '@/lib/supabase/client'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { reportError, setSentryUser } from '@/lib/observability/sentry'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { ErrorState } from '@/ui/error-state'
import { Session, User } from '@supabase/supabase-js'
import { ReactNode, createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: Error | null
  retry: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type Props = {
  children: ReactNode
}

export function AuthProvider({ children }: Props) {
  const { identifyUser, resetAnalyticsUser, track } = usePostHog()
  const previousAnalyticsUserId = useRef<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const bootstrapSession = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    track('anonymous_auth_bootstrap_started')

    try {
      const existingSession = await getSession()
      const nextSession = existingSession ?? (await signInAnonymously())

      setSession(nextSession)
      track('anonymous_auth_bootstrap_completed', {
        had_existing_session: Boolean(existingSession),
      })
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Unable to start anonymous session.')

      setError(nextError)
      reportError(caughtError)
      track('anonymous_auth_bootstrap_failed')
    } finally {
      setIsLoading(false)
    }
  }, [track])

  useEffect(() => {
    void bootstrapSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [bootstrapSession])

  useEffect(() => {
    const userId = session?.user.id ?? null
    if (userId) {
      identifyUser(userId)
      setSentryUser(userId)
      previousAnalyticsUserId.current = userId
      return
    }
    if (previousAnalyticsUserId.current) {
      resetAnalyticsUser()
      setSentryUser(null)
      previousAnalyticsUserId.current = null
    }
  }, [identifyUser, resetAnalyticsUser, session?.user.id])

  const handleSignOut = useCallback(async () => {
    await signOut()
    resetAnalyticsUser()
    setSentryUser(null)
    previousAnalyticsUserId.current = null
    setSession(null)
    track('anonymous_auth_signed_out')
  }, [resetAnalyticsUser, track])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      error,
      retry: bootstrapSession,
      signOut: handleSignOut,
    }),
    [bootstrapSession, error, handleSignOut, isLoading, session]
  )

  if (isLoading) {
    return (
      <AppLoadingScreen
        message="Starting Recipe Dost..."
        detail="Setting the table for your recipes"
      />
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Could not start Recipe Dost"
        message={error.message}
        retryLabel="Retry"
        onRetry={() => {
          void bootstrapSession()
        }}
      />
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = use(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return value
}
