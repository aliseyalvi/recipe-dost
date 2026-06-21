import { getSession, signInAnonymously, signOut } from '@/lib/supabase/auth'
import { supabase } from '@/lib/supabase/client'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Session, User } from '@supabase/supabase-js'
import { ReactNode, createContext, use, useCallback, useEffect, useMemo, useState } from 'react'

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
  const { track } = usePostHog()
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
      track('anonymous_auth_bootstrap_failed', {
        message: nextError.message,
      })
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

  const handleSignOut = useCallback(async () => {
    await signOut()
    setSession(null)
    track('anonymous_auth_signed_out')
  }, [track])

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
    return <LoadingState message="Starting Recipe Dost..." />
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
