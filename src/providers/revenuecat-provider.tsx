import {
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
} from '@/config/revenuecat'
import {
  reconcileSubscriptionAccess,
  type SubscriptionSyncResult,
} from '@/features/subscription/subscription-reconciliation'
import {
  deriveSubscriptionState,
  getEntitlementEvidenceFingerprint,
  getLocalEntitlementEvidence,
  type LocalEntitlementEvidence,
  type SubscriptionRefreshTrigger,
  type SubscriptionState,
  type SynchronizationState,
} from '@/features/subscription/subscription-state'
import {
  AI_ACCESS_STALE_TIME_MS,
  aiAccessQueryKey,
  isAiAccessCacheStale,
  useAiAccessQuery,
} from '@/lib/query/ai-access-query'
import { reportError } from '@/lib/observability/sentry'
import {
  canSynchronizeRevenueCatIdentity,
  resetRevenueCatIdentity,
  synchronizeRevenueCatIdentity,
} from '@/lib/revenuecat/runtime-identity'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { useQueryClient } from '@tanstack/react-query'
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal'
import Purchases from 'react-native-purchases'
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
import { AppState } from 'react-native'

export type SubscriptionActionResult = {
  customerInfo: CustomerInfo | null
  syncResult: SubscriptionSyncResult
  state: SubscriptionState
}

type RevenueCatContextValue = {
  isConfigured: boolean
  isLoading: boolean
  isReadyForCurrentUser: boolean
  isPremium: boolean
  customerInfo: CustomerInfo | null
  currentOffering: PurchasesOffering | null
  packages: PurchasesPackage[]
  error: string | null
  subscriptionState: SubscriptionState
  refreshCustomerInfo: () => Promise<CustomerInfo | null>
  refreshOfferings: () => Promise<PurchasesOffering | null>
  reconcileSubscription: (
    trigger: SubscriptionRefreshTrigger
  ) => Promise<SubscriptionSyncResult>
  refreshSubscription: () => Promise<SubscriptionActionResult>
  restoreSubscription: () => Promise<SubscriptionActionResult>
  purchaseSubscription: (
    selectedPackage: PurchasesPackage
  ) => Promise<SubscriptionActionResult>
  resetForAccountDeletion: () => Promise<void>
}

type StateMeta = {
  trigger: SubscriptionRefreshTrigger
  synchronizationState: SynchronizationState
  errorCode: string | null
  restoreCompleted: boolean
}

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null)
const PLANS_UNAVAILABLE_MESSAGE =
  'Plans unavailable right now. Please try again later.'

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { track, trackEvent } = usePostHog()
  const aiAccessQuery = useAiAccessQuery(user?.id)
  const mountedRef = useRef(false)
  const explicitStoreActionRef = useRef(false)
  const listenerFingerprintRef = useRef<string | null>(null)
  const lastSuccessfulBackendAccessRef = useRef(aiAccessQuery.data ?? null)
  const lastBackendAccessUserIdRef = useRef(user?.id ?? null)
  const restoreInFlightRef = useRef<Promise<SubscriptionActionResult> | null>(null)
  const refreshInFlightRef = useRef<Promise<SubscriptionActionResult> | null>(null)
  const purchaseInFlightRef = useRef<Promise<SubscriptionActionResult> | null>(null)
  const previousStateRef = useRef<SubscriptionState['kind'] | null>(null)
  const subscriptionStateRef = useRef<SubscriptionState | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [configuredUserId, setConfiguredUserId] = useState<string | null>(null)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stateMeta, setStateMeta] = useState<StateMeta>({
    trigger: 'bootstrap',
    synchronizationState: 'idle',
    errorCode: null,
    restoreCompleted: false,
  })

  if (lastBackendAccessUserIdRef.current !== (user?.id ?? null)) {
    lastBackendAccessUserIdRef.current = user?.id ?? null
    lastSuccessfulBackendAccessRef.current = null
  }

  if (aiAccessQuery.data && user?.id === lastBackendAccessUserIdRef.current) {
    lastSuccessfulBackendAccessRef.current = aiAccessQuery.data
  }

  const localEvidence = useMemo(
    () => getLocalEntitlementEvidence(customerInfo, REVENUECAT_ENTITLEMENT_ID),
    [customerInfo]
  )
  const isPremium = localEvidence.active
  const isReadyForCurrentUser =
    isConfigured && Boolean(user?.id) && configuredUserId === user?.id
  const subscriptionState = useMemo(
    () =>
      deriveSubscriptionState({
        backendAccess: aiAccessQuery.data,
        lastSuccessfulBackendAccess: lastSuccessfulBackendAccessRef.current,
        localEvidence,
        synchronizationState: stateMeta.synchronizationState,
        errorCode: stateMeta.errorCode ?? (aiAccessQuery.error ? 'ai_access_refresh_failed' : null),
        trigger: stateMeta.trigger,
        restoreCompleted: stateMeta.restoreCompleted,
        initializing: isLoading || aiAccessQuery.isLoading,
      }),
    [
      aiAccessQuery.data,
      aiAccessQuery.error,
      aiAccessQuery.isLoading,
      isLoading,
      localEvidence,
      stateMeta,
    ]
  )
  subscriptionStateRef.current = subscriptionState

  const updateCustomerInfo = useCallback((nextInfo: CustomerInfo | null) => {
    listenerFingerprintRef.current = getEntitlementEvidenceFingerprint(
      getLocalEntitlementEvidence(nextInfo, REVENUECAT_ENTITLEMENT_ID)
    )
    if (mountedRef.current) setCustomerInfo(nextInfo)
  }, [])

  const reconcileSubscription = useCallback(
    async (trigger: SubscriptionRefreshTrigger) => {
      if (!user?.id) {
        return {
          ok: false,
          syncStatus: 'failed',
          errorCode: 'auth_required',
        } satisfies SubscriptionSyncResult
      }
      const startedAt = Date.now()
      setStateMeta({
        trigger,
        synchronizationState: 'synchronizing',
        errorCode: null,
        restoreCompleted: false,
      })
      trackEvent('subscription_refresh_started', getEventProperties({
        trigger,
        state: subscriptionStateRef.current!,
        syncResult: 'started',
      }))
      const result = await reconcileSubscriptionAccess({
        queryClient,
        userId: user.id,
        trigger,
      })
      if (mountedRef.current) {
        setStateMeta({
          trigger,
          synchronizationState: result.syncStatus,
          errorCode: result.errorCode ?? null,
          restoreCompleted: trigger === 'restore',
        })
      }
      trackEvent(
        result.ok ? 'subscription_refresh_completed' : 'subscription_refresh_failed',
        getEventProperties({
          trigger,
          state: subscriptionStateRef.current!,
          syncResult: result.syncStatus,
          errorCode: result.errorCode,
          startedAt,
        })
      )
      return result
    },
    [queryClient, trackEvent, user?.id]
  )

  const buildActionResult = useCallback(
    ({
      info,
      evidence,
      syncResult,
      trigger,
      restoreCompleted = false,
    }: {
      info: CustomerInfo | null
      evidence: LocalEntitlementEvidence
      syncResult: SubscriptionSyncResult
      trigger: SubscriptionRefreshTrigger
      restoreCompleted?: boolean
    }): SubscriptionActionResult => ({
      customerInfo: info,
      syncResult,
      state: deriveSubscriptionState({
        backendAccess: syncResult.backendAccess,
        lastSuccessfulBackendAccess: lastSuccessfulBackendAccessRef.current,
        localEvidence: evidence,
        synchronizationState: syncResult.syncStatus,
        errorCode: syncResult.errorCode ?? null,
        trigger,
        restoreCompleted,
      }),
    }),
    []
  )

  const refreshCustomerInfo = useCallback(async () => {
    if (!isReadyForCurrentUser) return null
    try {
      const info = await Purchases.getCustomerInfo()
      updateCustomerInfo(info)
      return info
    } catch (caughtError) {
      reportError(caughtError)
      return null
    }
  }, [isReadyForCurrentUser, updateCustomerInfo])

  const refreshSubscription = useCallback(() => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current
    const action = (async () => {
      if (!isReadyForCurrentUser) throw new Error('Premium is still checking your app profile.')
      explicitStoreActionRef.current = true
      try {
        await Purchases.invalidateCustomerInfoCache()
        const info = await Purchases.getCustomerInfo()
        const evidence = getLocalEntitlementEvidence(info, REVENUECAT_ENTITLEMENT_ID)
        updateCustomerInfo(info)
        const syncResult = await reconcileSubscription('refresh')
        return buildActionResult({ info, evidence, syncResult, trigger: 'refresh' })
      } finally {
        explicitStoreActionRef.current = false
      }
    })()
    refreshInFlightRef.current = action
    const clearRefresh = () => {
      if (refreshInFlightRef.current === action) refreshInFlightRef.current = null
    }
    void action.then(clearRefresh, clearRefresh)
    return action
  }, [buildActionResult, isReadyForCurrentUser, reconcileSubscription, updateCustomerInfo])

  const restoreSubscription = useCallback(() => {
    if (restoreInFlightRef.current) return restoreInFlightRef.current
    const startedAt = Date.now()
    const action = (async () => {
      if (!isReadyForCurrentUser) throw new Error('Premium is still checking your app profile.')
      explicitStoreActionRef.current = true
      trackEvent('subscription_restore_started', getEventProperties({
        trigger: 'restore', state: subscriptionStateRef.current!, syncResult: 'started',
      }))
      try {
        const info = await Purchases.restorePurchases()
        const evidence = getLocalEntitlementEvidence(info, REVENUECAT_ENTITLEMENT_ID)
        updateCustomerInfo(info)
        const syncResult = await reconcileSubscription('restore')
        const result = buildActionResult({
          info,
          evidence,
          syncResult,
          trigger: 'restore',
          restoreCompleted: true,
        })
        const event = !evidence.active
          ? 'subscription_restore_no_entitlement'
          : result.state.kind === 'premium_confirmed'
            ? 'subscription_restore_completed'
            : 'subscription_restore_failed'
        trackEvent(event, getEventProperties({
          trigger: 'restore', state: result.state, syncResult: syncResult.syncStatus,
          errorCode: syncResult.errorCode, startedAt,
        }))
        return result
      } catch (caughtError) {
        trackEvent('subscription_restore_failed', getEventProperties({
          trigger: 'restore', state: subscriptionStateRef.current!, syncResult: 'failed',
          errorCode: 'restore_failed', startedAt,
        }))
        throw caughtError
      } finally {
        explicitStoreActionRef.current = false
      }
    })()
    restoreInFlightRef.current = action
    const clearRestore = () => {
      if (restoreInFlightRef.current === action) restoreInFlightRef.current = null
    }
    void action.then(clearRestore, clearRestore)
    return action
  }, [buildActionResult, isReadyForCurrentUser, reconcileSubscription, trackEvent, updateCustomerInfo])

  const purchaseSubscription = useCallback((selectedPackage: PurchasesPackage) => {
    if (purchaseInFlightRef.current) return purchaseInFlightRef.current
    const startedAt = Date.now()
    const action = (async () => {
      if (!isReadyForCurrentUser) throw new Error('Premium is still checking your app profile.')
      explicitStoreActionRef.current = true
      trackEvent('purchase_reconciliation_started', getEventProperties({
        trigger: 'purchase', state: subscriptionStateRef.current!, syncResult: 'started',
      }))
      try {
        const purchased = await Purchases.purchasePackage(selectedPackage)
        const info = purchased.customerInfo
        const evidence = getLocalEntitlementEvidence(info, REVENUECAT_ENTITLEMENT_ID)
        updateCustomerInfo(info)
        if (!evidence.active) {
          const failed: SubscriptionSyncResult = {
            ok: false,
            syncStatus: 'failed',
            errorCode: 'entitlement_not_active',
          }
          const result = buildActionResult({ info, evidence, syncResult: failed, trigger: 'purchase' })
          trackEvent('purchase_reconciliation_failed', getEventProperties({
            trigger: 'purchase', state: result.state, syncResult: 'failed',
            errorCode: failed.errorCode, startedAt,
          }))
          return result
        }
        const syncResult = await reconcileSubscription('purchase')
        const result = buildActionResult({ info, evidence, syncResult, trigger: 'purchase' })
        trackEvent(
          result.state.kind === 'premium_confirmed'
            ? 'purchase_reconciliation_completed'
            : 'purchase_reconciliation_failed',
          getEventProperties({
            trigger: 'purchase', state: result.state, syncResult: syncResult.syncStatus,
            errorCode: syncResult.errorCode, startedAt,
          })
        )
        return result
      } catch (caughtError) {
        trackEvent('purchase_reconciliation_failed', getEventProperties({
          trigger: 'purchase', state: subscriptionStateRef.current!, syncResult: 'failed',
          errorCode: 'purchase_failed', startedAt,
        }))
        throw caughtError
      } finally {
        explicitStoreActionRef.current = false
      }
    })()
    purchaseInFlightRef.current = action
    const clearPurchase = () => {
      if (purchaseInFlightRef.current === action) purchaseInFlightRef.current = null
    }
    void action.then(clearPurchase, clearPurchase)
    return action
  }, [buildActionResult, isReadyForCurrentUser, reconcileSubscription, trackEvent, updateCustomerInfo])

  const refreshOfferings = useCallback(async () => {
    if (!isConfigured) return null
    try {
      const offerings = await Purchases.getOfferings()
      const offering = offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current
      if (mountedRef.current) setCurrentOffering(offering)
      return offering
    } catch (caughtError) {
      reportError(caughtError)
      if (mountedRef.current) {
        setError(PLANS_UNAVAILABLE_MESSAGE)
        setCurrentOffering(null)
        track('premium_offerings_refresh_failed')
      }
      return null
    }
  }, [isConfigured, track])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!user?.id || !canSynchronizeRevenueCatIdentity()) {
      setIsConfigured(false)
      setConfiguredUserId(null)
      setCustomerInfo(null)
      setCurrentOffering(null)
      setError(null)
      setIsLoading(false)
      return
    }
    let active = true
    const configure = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const info = await synchronizeRevenueCatIdentity(user.id)
        if (!active || !mountedRef.current) return
        if (!info) return
        updateCustomerInfo(info)
        setConfiguredUserId(user.id)
        setIsConfigured(true)
        const evidence = getLocalEntitlementEvidence(info, REVENUECAT_ENTITLEMENT_ID)
        const cachedAccess = queryClient.getQueryData<{
          premiumActive: boolean
        }>(aiAccessQueryKey(user.id))
        const storeBackendMismatch =
          Boolean(cachedAccess) &&
          evidence.active !== cachedAccess?.premiumActive
        if (isAiAccessCacheStale(queryClient, user.id) || storeBackendMismatch) {
          await reconcileSubscription('bootstrap')
        }
        const offerings = await Purchases.getOfferings()
        if (active && mountedRef.current) {
          setCurrentOffering(offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current)
        }
      } catch (caughtError) {
        reportError(caughtError)
        if (active && mountedRef.current) setError(PLANS_UNAVAILABLE_MESSAGE)
      } finally {
        if (active && mountedRef.current) setIsLoading(false)
      }
    }
    void configure()
    return () => { active = false }
  }, [queryClient, reconcileSubscription, updateCustomerInfo, user?.id])

  useEffect(() => {
    if (!isReadyForCurrentUser) return
    const listener = (info: CustomerInfo) => {
      const evidence = getLocalEntitlementEvidence(info, REVENUECAT_ENTITLEMENT_ID)
      const nextFingerprint = getEntitlementEvidenceFingerprint(evidence)
      const changed = listenerFingerprintRef.current !== nextFingerprint
      updateCustomerInfo(info)
      if (changed && !explicitStoreActionRef.current) {
        void reconcileSubscription('listener')
      }
    }
    Purchases.addCustomerInfoUpdateListener(listener)
    return () => { Purchases.removeCustomerInfoUpdateListener(listener) }
  }, [isReadyForCurrentUser, reconcileSubscription, updateCustomerInfo])

  useEffect(() => {
    if (!user?.id || !isReadyForCurrentUser) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isAiAccessCacheStale(queryClient, user.id)) {
        void reconcileSubscription('foreground')
      }
    })
    return () => subscription.remove()
  }, [isReadyForCurrentUser, queryClient, reconcileSubscription, user?.id])

  useEffect(() => {
    const previous = previousStateRef.current
    if (previous && previous !== subscriptionState.kind) {
      trackEvent('subscription_state_transition', {
        ...getEventProperties({
          trigger: subscriptionState.refreshTrigger,
          state: subscriptionState,
          syncResult: subscriptionState.synchronizationState,
        }),
        state_before: previous,
        state_after: subscriptionState.kind,
      })
    }
    previousStateRef.current = subscriptionState.kind
  }, [subscriptionState, trackEvent])

  const resetForAccountDeletion = useCallback(async () => {
    try {
      await resetRevenueCatIdentity()
    } finally {
      setConfiguredUserId(null)
      setCustomerInfo(null)
      setCurrentOffering(null)
      setIsConfigured(false)
      setIsLoading(false)
    }
  }, [])

  const value = useMemo<RevenueCatContextValue>(() => ({
    isConfigured,
    isLoading,
    isReadyForCurrentUser,
    isPremium,
    customerInfo,
    currentOffering,
    packages: currentOffering?.availablePackages ?? [],
    error,
    subscriptionState,
    refreshCustomerInfo,
    refreshOfferings,
    reconcileSubscription,
    refreshSubscription,
    restoreSubscription,
    purchaseSubscription,
    resetForAccountDeletion,
  }), [
    customerInfo, currentOffering, error, isConfigured, isLoading,
    isPremium, isReadyForCurrentUser, purchaseSubscription,
    reconcileSubscription, refreshCustomerInfo, refreshOfferings,
    refreshSubscription, resetForAccountDeletion, restoreSubscription,
    subscriptionState,
  ])

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>
}

export function useRevenueCat() {
  const value = use(RevenueCatContext)
  if (!value) throw new Error('useRevenueCat must be used inside RevenueCatProvider.')
  return value
}

export function isCustomerPremium(customerInfo: CustomerInfo | null) {
  return Boolean(getPremiumEntitlement(customerInfo))
}

export function getPremiumEntitlement(customerInfo: CustomerInfo | null) {
  return customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENT_ID] ?? null
}

export function getSubscriptionManagementUrl(customerInfo: CustomerInfo | null) {
  return customerInfo?.managementURL ?? null
}

export function isRevenueCatCancellation(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; userCancelled?: unknown }
  return record.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    record.userCancelled === true
}

function getEventProperties({
  trigger,
  state,
  syncResult,
  errorCode,
  startedAt,
}: {
  trigger: SubscriptionRefreshTrigger
  state: SubscriptionState
  syncResult: string
  errorCode?: string
  startedAt?: number
}) {
  return {
    trigger,
    local_entitlement_active: state.localEntitlementActive,
    backend_premium_active: state.backendPremiumActive,
    expiration_relation: state.localExpirationRelation,
    provider_environment: state.providerEnvironment,
    sync_result: syncResult,
    normalized_error_code: errorCode ?? 'none',
    latency_bucket: startedAt ? getLatencyBucket(Date.now() - startedAt) : 'not_applicable',
  }
}

function getLatencyBucket(durationMs: number) {
  if (durationMs < 500) return 'under_500ms'
  if (durationMs < 2_000) return '500ms_2s'
  if (durationMs < 5_000) return '2s_5s'
  return 'over_5s'
}

export { AI_ACCESS_STALE_TIME_MS }
