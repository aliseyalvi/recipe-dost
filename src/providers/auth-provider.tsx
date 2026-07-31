import {
  AuthOperationGate,
  type AccountRecoveryState,
  assertSameUserId,
  bootstrapAuthSession,
  completeAnonymousAccountPassword,
  getAccountRecoveryState,
  recoverLinkedAccount,
  requestAnonymousAccountLink,
  shouldConfirmGuestSwitch,
  verifyAnonymousAccountEmail,
} from '@/features/account-recovery/account-recovery'
import { reportError, setSentryUser } from '@/lib/observability/sentry'
import { clearAiAccessForUser } from '@/lib/query/ai-access-query'
import {
  clearUserOwnedQueries,
  refreshUserOwnedQueries,
} from '@/lib/query/user-owned-query-cache'
import {
  resetRevenueCatIdentity,
  synchronizeRevenueCatIdentity,
} from '@/lib/revenuecat/runtime-identity'
import {
  clearSessionLocally,
  getSession,
  getVerifiedUser,
  hasMeaningfulCurrentUserData,
  resendCurrentUserEmailChange,
  signInAnonymously,
  signInWithPassword as signInWithSupabasePassword,
  signOut,
  updateCurrentUserEmail,
  updateCurrentUserPassword,
  verifyCurrentUserEmailChange,
} from '@/lib/supabase/auth'
import { supabase } from '@/lib/supabase/client'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { ErrorState } from '@/ui/error-state'
import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import {
  type ReactNode,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type RecoverySignInResult = {
  recovered: boolean
  requiresGuestSwitchConfirmation: boolean
  subscriptionRefreshPending: boolean
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: Error | null
  accountState: AccountRecoveryState
  accountError: string | null
  subscriptionRefreshPending: boolean
  acknowledgeSubscriptionRefresh: () => void
  retry: () => Promise<void>
  requestAccountLink: (email: string) => Promise<void>
  resendAccountLinkCode: (email: string) => Promise<void>
  verifyAccountLinkCode: (input: {
    email: string
    token: string
  }) => Promise<void>
  completeAccountLinkPassword: (password: string) => Promise<void>
  signInToRecover: (input: {
    email: string
    password: string
    confirmGuestSwitch?: boolean
  }) => Promise<RecoverySignInResult>
  signOut: () => Promise<void>
  clearDeletedSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type Props = {
  children: ReactNode
}

export function AuthProvider({ children }: Props) {
  const queryClient = useQueryClient()
  const { identifyUser, resetAnalyticsUser, track, trackEvent } = usePostHog()
  const previousAnalyticsUserId = useRef<string | null>(null)
  const previousQueryUserId = useRef<string | null>(null)
  const linkingUserIdRef = useRef<string | null>(null)
  const verifiedLinkUserIdRef = useRef<string | null>(null)
  const linkingSessionRef = useRef<Session | null>(null)
  const operationGateRef = useRef(new AuthOperationGate())
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [accountState, setAccountState] =
    useState<AccountRecoveryState>('signing_in')
  const [accountError, setAccountError] = useState<string | null>(null)
  const [subscriptionRefreshPending, setSubscriptionRefreshPending] =
    useState(false)

  const bootstrapSession = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setAccountError(null)
    setAccountState('signing_in')
    track('anonymous_auth_bootstrap_started')

    try {
      await bootstrapAuthSession({
        gate: operationGateRef.current,
        getSession,
        signInAnonymously,
      })
      const finalSession = await getSession()

      if (!finalSession) {
        throw new Error('Unable to establish an authenticated session.')
      }

      setSession(finalSession)
      setAccountState(getAccountRecoveryState(finalSession.user))
      track('anonymous_auth_bootstrap_completed')
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Unable to start an authenticated session.')

      setError(nextError)
      setAccountState('error')
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
      if (operationGateRef.current.isBusy) {
        return
      }

      setSession(nextSession)
      setAccountState(getAccountRecoveryState(nextSession?.user ?? null))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [bootstrapSession])

  useEffect(() => {
    const userId = session?.user.id ?? null
    const previousUserId = previousQueryUserId.current

    if (previousUserId && previousUserId !== userId) {
      clearAiAccessForUser(queryClient, previousUserId)
    }
    previousQueryUserId.current = userId

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
  }, [identifyUser, queryClient, resetAnalyticsUser, session?.user.id])

  const refreshRecoveredIdentity = useCallback(
    async (userId: string) => {
      try {
        await synchronizeRevenueCatIdentity(userId)
        setSubscriptionRefreshPending(false)
        trackEvent('account_recovery_subscription_refreshed', undefined)
        return false
      } catch (caughtError) {
        reportError(caughtError)
        setSubscriptionRefreshPending(true)
        trackEvent('account_recovery_subscription_refresh_pending', undefined)
        return true
      }
    },
    [trackEvent]
  )

  const requestAccountLink = useCallback(
    async (email: string) => {
      setAccountState('linking')
      setAccountError(null)
      setSubscriptionRefreshPending(false)
      trackEvent('account_link_started', { method: 'email_password' })

      try {
        verifiedLinkUserIdRef.current = null
        const result = await operationGateRef.current.run('linking', async () => {
          linkingSessionRef.current = await getSession()
          return requestAnonymousAccountLink({
            email,
            dependencies: {
              getSession,
              updateEmail: updateCurrentUserEmail,
            },
          })
        })
        linkingUserIdRef.current = result.originalUserId
        const finalSession = await getSession()
        if (finalSession) setSession(finalSession)
        trackEvent('account_link_verification_sent', {
          method: 'email_password',
          stage: 'initial',
        })
      } catch (caughtError) {
        const finalSession = await restoreOriginalLinkingSessionOnMismatch(
          caughtError,
          linkingSessionRef.current
        )
        if (finalSession) setSession(finalSession)
        setAccountState('error')
        setAccountError(getSafeAuthErrorMessage(caughtError))
        reportError(caughtError)
        trackEvent('account_link_failed', {
          method: 'email_password',
          stage: 'email',
        })
        throw new Error(getSafeAuthErrorMessage(caughtError))
      }
    },
    [trackEvent]
  )

  const verifyAccountLinkCode = useCallback(
    async ({
      email,
      token,
    }: {
      email: string
      token: string
    }) => {
      const originalUserId = linkingUserIdRef.current
      if (!originalUserId) {
        throw new Error('Start account security again before entering the code.')
      }

      setAccountState('linking')
      setAccountError(null)

      try {
        await operationGateRef.current.run('linking', async () => {
          const verifiedSession = await verifyAnonymousAccountEmail({
            email,
            token,
            originalUserId,
            dependencies: {
              getSession,
              verifyEmailChangeOtp: verifyCurrentUserEmailChange,
            },
          })
          verifiedLinkUserIdRef.current = verifiedSession.user.id
          setSession(verifiedSession as Session)
          setAccountState('linking')
        })
      } catch (caughtError) {
        const finalSession = await restoreOriginalLinkingSessionOnMismatch(
          caughtError,
          linkingSessionRef.current
        )
        if (finalSession) setSession(finalSession)
        setAccountState('error')
        setAccountError(getSafeAuthErrorMessage(caughtError))
        reportError(caughtError)
        trackEvent('account_link_failed', {
          method: 'email_password',
          stage: 'verification',
        })
        throw new Error(getSafeAuthErrorMessage(caughtError))
      }
    },
    [trackEvent]
  )

  const completeAccountLinkPassword = useCallback(
    async (password: string) => {
      const originalUserId = linkingUserIdRef.current
      if (
        !originalUserId ||
        verifiedLinkUserIdRef.current !== originalUserId
      ) {
        throw new Error('Verify the email before setting a password.')
      }

      setAccountState('linking')
      setAccountError(null)

      try {
        await operationGateRef.current.run('linking', async () => {
          const finalSession = await completeAnonymousAccountPassword({
            password,
            originalUserId,
            dependencies: {
              getSession,
              updatePassword: updateCurrentUserPassword,
            },
          })
          const refreshPending = await refreshRecoveredIdentity(
            finalSession.user.id
          )
          clearUserOwnedQueries(queryClient)
          setSession(finalSession as Session)
          await refreshUserOwnedQueries(queryClient)
          linkingUserIdRef.current = null
          verifiedLinkUserIdRef.current = null
          linkingSessionRef.current = null
          setAccountState('linked')
          setSubscriptionRefreshPending(refreshPending)
          trackEvent('account_link_completed', {
            method: 'email_password',
            subscription_refresh_pending: refreshPending,
          })
        })
      } catch (caughtError) {
        const finalSession = await restoreOriginalLinkingSessionOnMismatch(
          caughtError,
          linkingSessionRef.current
        )
        if (finalSession) setSession(finalSession)
        setAccountState('error')
        setAccountError(getSafeAuthErrorMessage(caughtError))
        reportError(caughtError)
        trackEvent('account_link_failed', {
          method: 'email_password',
          stage: 'verification',
        })
        throw new Error(getSafeAuthErrorMessage(caughtError))
      }
    },
    [queryClient, refreshRecoveredIdentity, trackEvent]
  )

  const resendAccountLinkCode = useCallback(
    async (email: string) => {
      if (!linkingUserIdRef.current) {
        throw new Error('Start account security again before requesting a code.')
      }

      setAccountState('linking')
      setAccountError(null)
      try {
        await operationGateRef.current.run('linking', async () => {
          const currentSession = await getSession()
          if (!currentSession) {
            throw new Error('The guest session could not be verified.')
          }
          assertSameUserId(
            linkingUserIdRef.current!,
            currentSession.user.id
          )
          await resendCurrentUserEmailChange(email)
        })
        trackEvent('account_link_verification_sent', {
          method: 'email_password',
          stage: 'resend',
        })
      } catch (caughtError) {
        setAccountState('error')
        setAccountError(getSafeAuthErrorMessage(caughtError))
        reportError(caughtError)
        trackEvent('account_link_failed', {
          method: 'email_password',
          stage: 'resend',
        })
        throw new Error(getSafeAuthErrorMessage(caughtError))
      }
    },
    [trackEvent]
  )

  const signInToRecover = useCallback(
    async ({
      email,
      password,
      confirmGuestSwitch = false,
    }: {
      email: string
      password: string
      confirmGuestSwitch?: boolean
    }): Promise<RecoverySignInResult> => {
      setAccountState('signing_in')
      setAccountError(null)
      setSubscriptionRefreshPending(false)
      trackEvent('account_recovery_sign_in_started', {
        method: 'email_password',
      })

      try {
        return await operationGateRef.current.run('signing_in', async () => {
          const currentSession = await getSession()
          const isAnonymous = Boolean(currentSession?.user.is_anonymous)

          if (isAnonymous && !confirmGuestSwitch) {
            const hasMeaningfulData = await hasMeaningfulCurrentUserData(
              currentSession!.user.id
            )
            if (
              shouldConfirmGuestSwitch({
                isAnonymous,
                hasMeaningfulData,
              })
            ) {
              setAccountState('anonymous_unlinked')
              trackEvent(
                'account_recovery_guest_switch_confirmation_required',
                undefined
              )
              return {
                recovered: false,
                requiresGuestSwitchConfirmation: true,
                subscriptionRefreshPending: false,
              }
            }
          }

          const finalSession = await recoverLinkedAccount({
            email,
            password,
            dependencies: {
              signInWithPassword: signInWithSupabasePassword,
              getVerifiedUser,
              getSession,
            },
          })
          setAccountState('recovering')
          const refreshPending = await refreshRecoveredIdentity(
            finalSession.user.id
          )
          clearUserOwnedQueries(queryClient)
          setSession(finalSession)
          await refreshUserOwnedQueries(queryClient)
          setAccountState('linked')
          setSubscriptionRefreshPending(refreshPending)
          trackEvent('account_recovery_completed', {
            method: 'email_password',
            replaced_empty_guest: isAnonymous,
            subscription_refresh_pending: refreshPending,
          })

          return {
            recovered: true,
            requiresGuestSwitchConfirmation: false,
            subscriptionRefreshPending: refreshPending,
          }
        })
      } catch (caughtError) {
        const finalSession = await getSession().catch(() => null)
        setSession(finalSession)
        setAccountState('error')
        setAccountError(getSafeAuthErrorMessage(caughtError))
        reportError(caughtError)
        trackEvent('account_recovery_sign_in_failed', {
          method: 'email_password',
        })
        throw new Error(getSafeAuthErrorMessage(caughtError))
      }
    },
    [queryClient, refreshRecoveredIdentity, trackEvent]
  )

  const handleSignOut = useCallback(async () => {
    setAccountError(null)

    try {
      await operationGateRef.current.run('sign_out', async () => {
        await signOut()
        try {
          await resetRevenueCatIdentity()
        } catch (caughtError) {
          reportError(caughtError)
          trackEvent('account_sign_out_subscription_reset_failed', undefined)
        }
        clearUserOwnedQueries(queryClient)
        resetAnalyticsUser()
        setSentryUser(null)
        previousAnalyticsUserId.current = null
        setSession(null)
        setAccountState('signed_out')
        setSubscriptionRefreshPending(false)
        trackEvent('account_signed_out', undefined)
      })
    } catch (caughtError) {
      setAccountState('error')
      setAccountError(getSafeAuthErrorMessage(caughtError))
      reportError(caughtError)
      throw new Error(getSafeAuthErrorMessage(caughtError))
    }
  }, [queryClient, resetAnalyticsUser, trackEvent])

  const clearDeletedSession = useCallback(async () => {
    try {
      await clearSessionLocally()
      await resetRevenueCatIdentity()
    } finally {
      clearUserOwnedQueries(queryClient)
      resetAnalyticsUser()
      setSentryUser(null)
      previousAnalyticsUserId.current = null
      setSession(null)
      setAccountState('signed_out')
    }
  }, [queryClient, resetAnalyticsUser])

  const acknowledgeSubscriptionRefresh = useCallback(() => {
    setSubscriptionRefreshPending(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      error,
      accountState,
      accountError,
      subscriptionRefreshPending,
      acknowledgeSubscriptionRefresh,
      retry: bootstrapSession,
      requestAccountLink,
      resendAccountLinkCode,
      verifyAccountLinkCode,
      completeAccountLinkPassword,
      signInToRecover,
      signOut: handleSignOut,
      clearDeletedSession,
    }),
    [
      accountError,
      accountState,
      acknowledgeSubscriptionRefresh,
      bootstrapSession,
      clearDeletedSession,
      completeAccountLinkPassword,
      error,
      handleSignOut,
      isLoading,
      requestAccountLink,
      resendAccountLinkCode,
      session,
      signInToRecover,
      subscriptionRefreshPending,
      verifyAccountLinkCode,
    ]
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

async function restoreOriginalLinkingSessionOnMismatch(
  error: unknown,
  originalSession: Session | null
) {
  const isMismatch =
    error instanceof Error && error.message.toLowerCase().includes('different user')

  if (!isMismatch || !originalSession) {
    return getSession().catch(() => null)
  }

  const { data, error: restoreError } = await supabase.auth.setSession({
    access_token: originalSession.access_token,
    refresh_token: originalSession.refresh_token,
  })

  if (restoreError) {
    reportError(restoreError)
    return originalSession
  }

  return data.session ?? originalSession
}

function getSafeAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  const status =
    error && typeof error === 'object' && 'status' in error
      ? (error as { status?: unknown }).status
      : null

  if (message.includes('different user')) {
    return 'Account verification returned a different user. Nothing was migrated.'
  }
  if (
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many')
  ) {
    return 'Too many verification emails were requested. Please wait before trying again.'
  }
  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('already been registered')
  ) {
    return 'That email is already connected to another account. Sign in to recover it instead.'
  }
  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return 'The email or password is incorrect.'
  }
  if (
    message.includes('expired') ||
    message.includes('token has expired') ||
    message.includes('otp')
  ) {
    return 'That verification code is invalid or expired. Request a new code and try again.'
  }
  if (
    message.includes('email not confirmed') ||
    message.includes('email_not_confirmed')
  ) {
    return 'Verify your email with the code before setting the password.'
  }
  if (message.includes('password')) {
    return 'Use a stronger password with at least 8 characters.'
  }
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout')
  ) {
    return 'Recipe Dost could not reach the account service. Check your connection and retry.'
  }
  if (message.includes('current guest session')) {
    return 'This account is no longer a guest account.'
  }
  if (message.includes('already in progress')) {
    return 'Another account action is still finishing. Please wait and retry.'
  }

  return 'The account action could not be completed safely. Please retry.'
}
