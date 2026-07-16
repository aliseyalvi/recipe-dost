import {
  REVENUECAT_ANDROID_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
} from '@/config/revenuecat'
import {
  syncPremiumEntitlement as syncRevenueCatPremiumEntitlement,
  type SyncedPremiumEntitlement,
} from '@/lib/api/premium-entitlement'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { reportError } from '@/lib/observability/sentry'
import { useQueryClient } from '@tanstack/react-query'
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal'
import Purchases from 'react-native-purchases'
import {
  ReactNode,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform } from 'react-native'

type RevenueCatContextValue = {
  isConfigured: boolean
  isLoading: boolean
  isReadyForCurrentUser: boolean
  isPremium: boolean
  customerInfo: CustomerInfo | null
  currentOffering: PurchasesOffering | null
  packages: PurchasesPackage[]
  error: string | null
  refreshCustomerInfo: () => Promise<CustomerInfo | null>
  refreshOfferings: () => Promise<PurchasesOffering | null>
  syncPremiumEntitlement: () => Promise<SyncedPremiumEntitlement | null>
  purchasePackage: (selectedPackage: PurchasesPackage) => Promise<CustomerInfo>
  restorePurchases: () => Promise<CustomerInfo>
}

type Props = {
  children: ReactNode
}

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null)

const PLANS_UNAVAILABLE_MESSAGE =
  'Plans unavailable right now. Please try again later.'

let didConfigurePurchases = false
let configuredAppUserId: string | null = null

export function RevenueCatProvider({ children }: Props) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { track } = usePostHog()
  const mountedRef = useRef(false)
  const syncInFlightRef = useRef(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [configuredUserId, setConfiguredUserId] = useState<string | null>(null)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isPremium = useMemo(
    () => isCustomerPremium(customerInfo),
    [customerInfo]
  )
  const isReadyForCurrentUser =
    isConfigured && Boolean(user?.id) && configuredUserId === user?.id
  const packages = currentOffering?.availablePackages ?? []

  const setCustomerInfoSafely = useCallback((nextInfo: CustomerInfo | null) => {
    if (mountedRef.current) {
      setCustomerInfo(nextInfo)
    }
  }, [])

  const syncPremiumEntitlement = useCallback(async () => {
    if (syncInFlightRef.current) {
      return null
    }

    syncInFlightRef.current = true

    try {
      const synced = await syncRevenueCatPremiumEntitlement()

      if (!mountedRef.current) {
        return null
      }

      await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
      track('premium_entitlement_synced', {
        premium_active: synced.revenuecat_entitlement_active,
      })

      return synced
    } catch (caughtError) {
      reportError(caughtError)
      track('premium_entitlement_sync_failed')
      return null
    } finally {
      syncInFlightRef.current = false
    }
  }, [queryClient, track])

  const refreshCustomerInfo = useCallback(async () => {
    if (!isReadyForCurrentUser) {
      return null
    }

    try {
      const nextInfo = await Purchases.getCustomerInfo()

      if (!mountedRef.current) {
        return nextInfo
      }

      setCustomerInfoSafely(nextInfo)
      track('premium_status_refreshed', {
        is_premium: isCustomerPremium(nextInfo),
      })
      if (isCustomerPremium(nextInfo)) {
        await syncPremiumEntitlement()
      }

      return nextInfo
    } catch (caughtError) {
      reportError(caughtError)
      if (mountedRef.current) {
        setError('Could not refresh premium status. Please try again.')
      }

      return null
    }
  }, [isReadyForCurrentUser, setCustomerInfoSafely, syncPremiumEntitlement, track])

  const refreshOfferings = useCallback(async () => {
    if (!isConfigured) {
      return null
    }

    try {
      const offerings = await Purchases.getOfferings()
      const nextOffering =
        offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current

      if (!mountedRef.current) {
        return nextOffering
      }

      if (mountedRef.current) {
        setCurrentOffering(nextOffering)
      }

      return nextOffering
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

  const purchasePackage = useCallback(
    async (selectedPackage: PurchasesPackage) => {
      if (!isReadyForCurrentUser) {
        throw new Error('Premium is still checking your app profile.')
      }

      const result = await Purchases.purchasePackage(selectedPackage)

      if (!mountedRef.current) {
        return result.customerInfo
      }

      setCustomerInfoSafely(result.customerInfo)
      if (isCustomerPremium(result.customerInfo)) {
        await syncPremiumEntitlement()
      }

      return result.customerInfo
    },
    [isReadyForCurrentUser, setCustomerInfoSafely, syncPremiumEntitlement]
  )

  const restorePurchases = useCallback(async () => {
    if (!isReadyForCurrentUser) {
      throw new Error('Premium is still checking your app profile.')
    }

    const nextInfo = await Purchases.restorePurchases()

    if (!mountedRef.current) {
      return nextInfo
    }

    setCustomerInfoSafely(nextInfo)
    if (isCustomerPremium(nextInfo)) {
      await syncPremiumEntitlement()
    }

    return nextInfo
  }, [isReadyForCurrentUser, setCustomerInfoSafely, syncPremiumEntitlement])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const androidApiKey = REVENUECAT_ANDROID_API_KEY

    if (!user?.id || Platform.OS !== 'android' || !androidApiKey) {
      setIsConfigured(false)
      setConfiguredUserId(null)
      setIsLoading(false)
      return
    }

    let isActive = true

    const configure = async () => {
      setIsLoading(true)
      setError(null)
      let didReachConfiguredSdk = false

      try {
        if (!didConfigurePurchases) {
          Purchases.configure({
            apiKey: androidApiKey,
            appUserID: user.id,
          })
          didConfigurePurchases = true
          configuredAppUserId = user.id
          setConfiguredUserId(user.id)
        } else if (configuredAppUserId !== user.id) {
          const loginResult = await Purchases.logIn(user.id)

          if (!isActive || !mountedRef.current) {
            return
          }

          configuredAppUserId = user.id
          setConfiguredUserId(user.id)
          setCustomerInfoSafely(loginResult.customerInfo)
        } else {
          setConfiguredUserId(user.id)
        }

        didReachConfiguredSdk = true

        if (!isActive || !mountedRef.current) {
          return
        }

        setIsConfigured(true)

        const nextInfo = await Purchases.getCustomerInfo()

        if (!isActive || !mountedRef.current) {
          return
        }

        setCustomerInfo(nextInfo)
        track('premium_status_refreshed', {
          is_premium: isCustomerPremium(nextInfo),
        })
        if (isCustomerPremium(nextInfo)) {
          await syncPremiumEntitlement()
        }

        try {
          const offerings = await Purchases.getOfferings()

          if (!isActive || !mountedRef.current) {
            return
          }

          setCurrentOffering(
            offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current
          )
        } catch (caughtError) {
          reportError(caughtError)
          if (!isActive || !mountedRef.current) {
            return
          }

          setCurrentOffering(null)
          setError(PLANS_UNAVAILABLE_MESSAGE)
          track('premium_offerings_bootstrap_failed')
        }
      } catch (caughtError) {
        reportError(caughtError)
        if (isActive && mountedRef.current) {
          setIsConfigured(didReachConfiguredSdk)
          if (!didReachConfiguredSdk) {
            setCustomerInfo(null)
          }
          if (!didReachConfiguredSdk) {
            setCurrentOffering(null)
          }
          setError(PLANS_UNAVAILABLE_MESSAGE)
        }
      } finally {
        if (isActive && mountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    void configure()

    return () => {
      isActive = false
    }
  }, [setCustomerInfoSafely, syncPremiumEntitlement, track, user?.id])

  const value = useMemo<RevenueCatContextValue>(
    () => ({
      isConfigured,
      isLoading,
      isReadyForCurrentUser,
      isPremium,
      customerInfo,
      currentOffering,
      packages,
      error,
      refreshCustomerInfo,
      refreshOfferings,
      syncPremiumEntitlement,
      purchasePackage,
      restorePurchases,
    }),
    [
      customerInfo,
      currentOffering,
      error,
      isConfigured,
      isLoading,
      isReadyForCurrentUser,
      isPremium,
      packages,
      purchasePackage,
      refreshCustomerInfo,
      refreshOfferings,
      restorePurchases,
      syncPremiumEntitlement,
    ]
  )

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  )
}

export function useRevenueCat() {
  const value = use(RevenueCatContext)

  if (!value) {
    throw new Error('useRevenueCat must be used inside RevenueCatProvider.')
  }

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
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as {
    code?: unknown
    userCancelled?: unknown
  }

  return record.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    record.userCancelled === true
}
