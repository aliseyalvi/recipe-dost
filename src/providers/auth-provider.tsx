import {
  AuthCallbackGate,
  AuthOperationGate,
  SingleFlightRequestGate,
  type AccountRecoveryState,
  bootstrapAuthSession,
  getAccountRecoveryState,
  requestAnonymousAccountLink,
  shouldConfirmGuestSwitch,
  verifyAuthoritativeCallbackSession,
} from '@/features/account-recovery/account-recovery'
import {
  getCurrentLocalOnboardingState,
  hydrateOnboardingStore,
  markOnboardingCompleted,
} from '@/features/onboarding/onboarding-store'
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
  establishSessionFromAuthCallback,
  getAuthCallbackKind,
  getSession,
  getVerifiedUser,
  hasMeaningfulCurrentUserData,
  isAuthCallbackUrl,
  sendRecoveryMagicLink,
  signInAnonymously,
  signOut,
  updateCurrentUserEmail,
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
import { Linking } from 'react-native'

export type MagicLinkRequestResult = {
  requiresGuestSwitchConfirmation: boolean
}

export type AuthCallbackState = 'idle' | 'processing' | 'success' | 'error'

export type AuthReadiness =
  | 'initializing'
  | 'anonymous_ready'
  | 'linked_ready'
  | 'signed_out_ready'
  | 'recovering'
  | 'error'

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: Error | null
  authReadiness: AuthReadiness
  accountState: AccountRecoveryState
  accountError: string | null
  subscriptionRefreshPending: boolean
  acknowledgeSubscriptionRefresh: () => void
  retry: () => Promise<void>
  requestAccountLink: (email: string) => Promise<void>
  requestRecoveryLink: (input: {
    email: string
    confirmGuestSwitch?: boolean
  }) => Promise<MagicLinkRequestResult>
  authCallbackState: AuthCallbackState
  authCallbackError: string | null
  processAuthCallback: (callbackUrl: string) => Promise<void>
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
  const linkingSessionRef = useRef<Session | null>(null)
  const pendingMagicLinkRef = useRef<{
    mode: 'secure' | 'recover'
    email: string
    originalUserId?: string
  } | null>(null)
  const callbackGateRef = useRef(new AuthCallbackGate())
  const operationGateRef = useRef(new AuthOperationGate())
  const recoveryRequestGateRef = useRef(new SingleFlightRequestGate())
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [authReadiness, setAuthReadiness] =
    useState<AuthReadiness>('initializing')
  const [accountState, setAccountState] =
    useState<AccountRecoveryState>('signing_in')
  const [accountError, setAccountError] = useState<string | null>(null)
  const [subscriptionRefreshPending, setSubscriptionRefreshPending] =
    useState(false)
  const [authCallbackState, setAuthCallbackState] =
    useState<AuthCallbackState>('idle')
  const [authCallbackError, setAuthCallbackError] = useState<string | null>(null)

  const bootstrapSession = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setAuthReadiness('initializing')
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
      setAuthReadiness(getAuthReadiness(finalSession))
      track('anonymous_auth_bootstrap_completed')
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Unable to start an authenticated session.')

      setError(nextError)
      setAccountState('error')
      setAuthReadiness('error')
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
      setAuthReadiness(getAuthReadiness(nextSession))
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
      trackEvent('account_link_started', { method: 'email_magic_link' })

      try {
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
        pendingMagicLinkRef.current = {
          mode: 'secure',
          email,
          originalUserId: result.originalUserId,
        }
        const finalSession = await getSession()
        if (finalSession) setSession(finalSession)
        trackEvent('account_link_verification_sent', {
          method: 'email_magic_link',
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
          method: 'email_magic_link',
          stage: 'email',
        })
        throw new Error(getSafeAuthErrorMessage(caughtError))
      }
    },
    [trackEvent]
  )

  const requestRecoveryLink = useCallback(
    ({
      email,
      confirmGuestSwitch = false,
    }: {
      email: string
      confirmGuestSwitch?: boolean
    }): Promise<MagicLinkRequestResult> =>
      recoveryRequestGateRef.current.run(async () => {
        setAccountState('signing_in')
        setAuthReadiness('recovering')
        setAccountError(null)
        setSubscriptionRefreshPending(false)
        trackEvent('account_recovery_sign_in_started', {
          method: 'email_magic_link',
        })

        try {
          await operationGateRef.current.waitUntilIdle()
          return await operationGateRef.current.run('recovering', async () => {
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
                setAuthReadiness('anonymous_ready')
                trackEvent(
                  'account_recovery_guest_switch_confirmation_required',
                  undefined
                )
                return {
                  requiresGuestSwitchConfirmation: true,
                }
              }
            }

            await sendRecoveryMagicLink(email)
            pendingMagicLinkRef.current = { mode: 'recover', email }
            setAccountState(
              getAccountRecoveryState(currentSession?.user ?? null)
            )
            setAuthReadiness(getAuthReadiness(currentSession))

            return {
              requiresGuestSwitchConfirmation: false,
            }
          })
        } catch (caughtError) {
          const finalSession = await getSession().catch(() => null)
          setSession(finalSession)
          setAccountState('error')
          setAuthReadiness(getAuthReadiness(finalSession))
          setAccountError(getSafeAuthErrorMessage(caughtError))
          reportError(caughtError)
          trackEvent('account_recovery_sign_in_failed', {
            method: 'email_magic_link',
          })
          throw new Error(getSafeAuthErrorMessage(caughtError))
        }
      }),
    [trackEvent]
  )

  const processAuthCallback = useCallback(
    async (callbackUrl: string) => {
      if (!isAuthCallbackUrl(callbackUrl)) return

      await callbackGateRef.current.run(callbackUrl, async () => {
        setAuthCallbackState('processing')
        setAuthReadiness('recovering')
        setAuthCallbackError(null)
        await operationGateRef.current.waitUntilIdle()
        const originalSession = await getSession().catch(() => null)

        try {
          await operationGateRef.current.run('recovering', async () => {
            const pendingLink = pendingMagicLinkRef.current
            const callbackKind =
              getAuthCallbackKind(callbackUrl) ?? pendingLink?.mode ?? null
            if (!callbackKind) {
              throw new Error(
                'This sign-in link could not be identified. Request a new link.'
              )
            }

            let expectedUserId: string | null = null
            if (callbackKind === 'secure') {
              expectedUserId =
                pendingLink?.mode === 'secure'
                  ? pendingLink.originalUserId ?? null
                  : originalSession?.user.is_anonymous
                    ? originalSession.user.id
                    : null
              if (!expectedUserId) {
                throw new Error(
                  'Open the secure link on the device where it was requested.'
                )
              }
            } else if (
              originalSession?.user.is_anonymous &&
              pendingLink?.mode !== 'recover' &&
              (await hasMeaningfulCurrentUserData(originalSession.user.id))
            ) {
              throw new Error(
                'This device has guest data. Start recovery here and confirm the account switch first.'
              )
            }

            await establishSessionFromAuthCallback(callbackUrl)
            const finalSession = await verifyAuthoritativeCallbackSession({
              expectedUserId,
              expectedEmail: pendingLink?.email ?? null,
              dependencies: { getVerifiedUser, getSession },
            })

            setAccountState('recovering')
            clearUserOwnedQueries(queryClient)
            setSession(finalSession)
            await refreshUserOwnedQueries(queryClient)
            const refreshPending = await refreshRecoveredIdentity(
              finalSession.user.id
            )
            await hydrateOnboardingStore()
            const onboardingState = getCurrentLocalOnboardingState()
            if (onboardingState === 'error') {
              throw new Error('Could not save onboarding completion.')
            }
            if (onboardingState === 'incomplete') {
              await markOnboardingCompleted()
            }
            linkingUserIdRef.current = null
            linkingSessionRef.current = null
            pendingMagicLinkRef.current = null
            setAccountState('linked')
            setAuthReadiness('linked_ready')
            setSubscriptionRefreshPending(refreshPending)
            if (callbackKind === 'secure') {
              trackEvent('account_link_completed', {
                method: 'email_magic_link',
                subscription_refresh_pending: refreshPending,
              })
            } else {
              trackEvent('account_recovery_completed', {
                method: 'email_magic_link',
                replaced_empty_guest: Boolean(
                  originalSession?.user.is_anonymous
                ),
                subscription_refresh_pending: refreshPending,
              })
            }
          })
          setAuthCallbackState('success')
        } catch (caughtError) {
          const restoredSession = await restoreOriginalLinkingSessionOnMismatch(
            caughtError,
            originalSession
          )
          if (restoredSession) setSession(restoredSession)
          const safeMessage = getSafeAuthErrorMessage(caughtError)
          setAccountState('error')
          setAuthReadiness(getAuthReadiness(restoredSession))
          setAccountError(safeMessage)
          setAuthCallbackState('error')
          setAuthCallbackError(safeMessage)
          reportError(caughtError)
          throw new Error(safeMessage)
        }
      })
    },
    [queryClient, refreshRecoveredIdentity, trackEvent]
  )

  useEffect(() => {
    let active = true
    void Linking.getInitialURL().then((url) => {
      if (active && url && isAuthCallbackUrl(url)) {
        void processAuthCallback(url).catch(() => undefined)
      }
    })
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isAuthCallbackUrl(url)) {
        void processAuthCallback(url).catch(() => undefined)
      }
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [processAuthCallback])

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
        pendingMagicLinkRef.current = null
        setSession(null)
        setAccountState('signed_out')
        setAuthReadiness('signed_out_ready')
        setSubscriptionRefreshPending(false)
        setAuthCallbackState('idle')
        setAuthCallbackError(null)
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
      setAuthReadiness('signed_out_ready')
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
      authReadiness,
      accountState,
      accountError,
      subscriptionRefreshPending,
      acknowledgeSubscriptionRefresh,
      retry: bootstrapSession,
      requestAccountLink,
      requestRecoveryLink,
      authCallbackState,
      authCallbackError,
      processAuthCallback,
      signOut: handleSignOut,
      clearDeletedSession,
    }),
    [
      accountError,
      accountState,
      acknowledgeSubscriptionRefresh,
      authCallbackError,
      authCallbackState,
      bootstrapSession,
      clearDeletedSession,
      error,
      authReadiness,
      handleSignOut,
      isLoading,
      processAuthCallback,
      requestAccountLink,
      requestRecoveryLink,
      session,
      subscriptionRefreshPending,
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

function getAuthReadiness(session: Session | null): AuthReadiness {
  if (!session) return 'signed_out_ready'
  return session.user.is_anonymous ? 'anonymous_ready' : 'linked_ready'
}

async function restoreOriginalLinkingSessionOnMismatch(
  error: unknown,
  originalSession: Session | null
) {
  const isMismatch =
    error instanceof Error &&
    (error.message.toLowerCase().includes('different user') ||
      error.message.toLowerCase().includes('different account'))

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

  if (message.includes('different user') || message.includes('different account')) {
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
    message.includes('invalid') ||
    message.includes('expired') ||
    message.includes('token') ||
    message.includes('callback')
  ) {
    return 'This sign-in link is invalid or expired. Request a new link.'
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
  if (message.includes('device where it was requested')) {
    return 'Open this secure link on the device where it was requested.'
  }
  if (message.includes('guest data')) {
    return 'This device has guest data. Start recovery here and confirm the account switch first.'
  }
  if (message.includes('already in progress')) {
    return 'Another account action is still finishing. Please wait and retry.'
  }

  return 'The account action could not be completed safely. Please retry.'
}
