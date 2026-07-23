import {
  getIntroOfferText,
  getPackagePlan,
  getPackagePlanLabel,
  getPackagePriceSummary,
  getPaywallPurchaseErrorKind,
  getPaywallUsage,
  hasIntroOffer,
  mapPaywallPackages,
  normalizePaywallTrigger,
  PAYWALL_MONTHLY_PRODUCT_ID,
  PAYWALL_YEARLY_PRODUCT_ID,
  type PaywallPlan,
} from '@/features/paywall/paywall-model'
import {
  PaywallFeedback,
  PaywallHero,
  PaywallPlanCard,
  PaywallPlansLoading,
  PaywallPurchaseFooter,
  PaywallSheet,
  PaywallUnavailable,
  PlanComparisonTable,
  PremiumActivePanel,
  UsageProgress,
  type PaywallFeedbackTone,
} from '@/features/paywall/paywall-presentation'
import {
  getNormalizedSubscriptionStatus,
  getRecipeSubscriptionAvailabilityText,
} from '@/features/subscription/normalized-subscription-status'
import { useAiAccessQuery } from '@/lib/query/ai-access-query'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { reportError } from '@/lib/observability/sentry'
import {
  getPremiumEntitlement,
  getSubscriptionManagementUrl,
  useRevenueCat,
} from '@/providers/revenuecat-provider'
import { colors, spacing, typography } from '@/theme'
import type {
  CustomerInfo,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Linking, Text, View } from 'react-native'
import { LegalLinks } from '@/features/legal/legal-links'

type PendingAction =
  | 'manage'
  | 'purchase'
  | 'restore'
  | 'retry_offerings'
  | 'retry_usage'

type PaywallFeedbackState = {
  message: string
  tone: PaywallFeedbackTone
}

export default function PaywallRoute() {
  const router = useRouter()
  const { trigger: triggerParam } = useLocalSearchParams<{
    trigger?: string | string[]
  }>()
  const { user } = useAuth()
  const { track } = usePostHog()
  const {
    isConfigured,
    isLoading,
    customerInfo,
    packages,
    refreshCustomerInfo,
    refreshOfferings,
    purchaseSubscription,
    refreshSubscription,
    restoreSubscription,
    subscriptionState,
  } = useRevenueCat()
  const trigger = normalizePaywallTrigger(triggerParam)
  const aiAccessQuery = useAiAccessQuery(user?.id)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [feedback, setFeedback] = useState<PaywallFeedbackState | null>(null)
  const actionRef = useRef<PendingAction | null>(null)
  const didTrackViewRef = useRef(false)
  const didTrackActiveViewRef = useRef(false)
  const didTrackUnavailableRef = useRef(false)
  const packageMap = useMemo(() => mapPaywallPackages(packages), [packages])
  const availablePackages = useMemo(
    () =>
      [packageMap.monthly, packageMap.yearly].filter(
        (item): item is PurchasesPackage => Boolean(item)
      ),
    [packageMap.monthly, packageMap.yearly]
  )
  const subscriptionStatus = getNormalizedSubscriptionStatus(subscriptionState)
  const isPremiumActive = subscriptionStatus.isPremium
  const usage = aiAccessQuery.data
    ? getPaywallUsage(aiAccessQuery.data, isPremiumActive)
    : null
  const selectedPackage =
    availablePackages.find((item) => item.identifier === selectedPackageId) ??
    packageMap.yearly ??
    packageMap.monthly ??
    null
  const selectedPlan = selectedPackage
    ? getPackagePlan(selectedPackage, packageMap)
    : null
  const plansLoading = !isPremiumActive && isLoading
  const plansUnavailable =
    !isPremiumActive &&
    !plansLoading &&
    (!isConfigured || availablePackages.length === 0)
  const shouldShowPurchaseFooter =
    !isPremiumActive &&
    !plansLoading &&
    !plansUnavailable &&
    Boolean(selectedPackage)
  const managementUrl = getSubscriptionManagementUrl(customerInfo)
  const currentPlan = getCurrentPlanLabel(customerInfo)
  const isBusy = pendingAction !== null

  useEffect(() => {
    if (didTrackViewRef.current) {
      return
    }

    didTrackViewRef.current = true
    track('paywall_viewed', {
      trigger,
      configured: isConfigured,
      package_count: packages.length,
      access_plan: subscriptionStatus.plan,
    })
  }, [isConfigured, packages.length, subscriptionStatus.plan, track, trigger])

  useEffect(() => {
    if (!isPremiumActive || didTrackActiveViewRef.current) {
      return
    }

    didTrackActiveViewRef.current = true
    track('premium_paywall_active_viewed', {
      trigger,
      has_management_url: Boolean(managementUrl),
      current_plan: currentPlan ?? 'unknown',
    })
  }, [currentPlan, isPremiumActive, managementUrl, track, trigger])

  useEffect(() => {
    if (!plansUnavailable || didTrackUnavailableRef.current) {
      return
    }

    didTrackUnavailableRef.current = true
    track('paywall_plans_unavailable', {
      trigger,
      configured: isConfigured,
    })
  }, [isConfigured, plansUnavailable, track, trigger])

  useEffect(() => {
    const preferredPackage = packageMap.yearly ?? packageMap.monthly

    if (!preferredPackage) {
      setSelectedPackageId(null)
      return
    }

    if (
      selectedPackageId &&
      availablePackages.some((item) => item.identifier === selectedPackageId)
    ) {
      return
    }

    setSelectedPackageId(preferredPackage.identifier)
  }, [availablePackages, packageMap.monthly, packageMap.yearly, selectedPackageId])

  const closePaywall = useCallback(
    (
      source:
        | 'android_back'
        | 'backdrop'
        | 'close_button'
        | 'maybe_later'
        | 'premium_close'
        | 'purchase_completed',
      force = false
    ) => {
      if (actionRef.current && !force) {
        return
      }

      track('paywall_closed', {
        trigger,
        source,
        access_plan: subscriptionStatus.plan,
      })

      if (router.canGoBack()) {
        router.back()
      } else {
        router.replace('/home')
      }
    },
    [router, subscriptionStatus.plan, track, trigger]
  )

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closePaywall('android_back')
        return true
      }
    )

    return () => subscription.remove()
  }, [closePaywall])

  const beginAction = (action: PendingAction) => {
    if (actionRef.current) {
      return false
    }

    actionRef.current = action
    setPendingAction(action)
    setFeedback(null)
    return true
  }

  const finishAction = () => {
    actionRef.current = null
    setPendingAction(null)
  }

  const handleSelectPackage = (
    nextPackage: PurchasesPackage,
    plan: PaywallPlan
  ) => {
    if (actionRef.current) {
      return
    }

    setSelectedPackageId(nextPackage.identifier)
    const properties = {
      trigger,
      selected_plan: plan,
      has_intro_offer: hasIntroOffer(nextPackage),
      access_plan: subscriptionStatus.plan,
    }
    track('premium_plan_card_tapped', properties)
    track('paywall_plan_selected', properties)
  }

  const handlePurchase = async () => {
    if (!selectedPackage || !selectedPlan || !beginAction('purchase')) {
      return
    }

    const purchaseProperties = {
      trigger,
      selected_plan: selectedPlan,
      has_intro_offer: hasIntroOffer(selectedPackage),
    }
    track('purchase_started', purchaseProperties)

    try {
      const result = await purchaseSubscription(selectedPackage)

      if (result.state.kind === 'premium_confirmed') {
        track('purchase_completed', {
          ...purchaseProperties,
          premium_active: true,
        })
        finishAction()
        closePaywall('purchase_completed', true)
        return
      }

      if (result.state.localEntitlementActive) {
        track('purchase_failed', {
          ...purchaseProperties,
          outcome: 'backend_access_pending',
        })
        setFeedback({
          message:
            'Purchase completed. Premium access is still refreshing. You can close and check again shortly.',
          tone: 'info',
        })
        return
      }

      track('purchase_failed', {
        ...purchaseProperties,
        outcome: 'entitlement_not_active',
      })
      setFeedback({
        message:
          'The purchase finished, but Premium is not active yet. Try Restore purchases.',
        tone: 'error',
      })
    } catch (caughtError) {
      const kind = getPaywallPurchaseErrorKind(caughtError)

      if (kind === 'cancelled') {
        track('purchase_cancelled', purchaseProperties)
        setFeedback({ message: 'Purchase cancelled.', tone: 'info' })
        return
      }

      if (kind === 'pending') {
        track('purchase_pending', purchaseProperties)
        setFeedback({
          message:
            'Your purchase is pending approval. Premium will activate after Google Play completes it.',
          tone: 'info',
        })
        return
      }

      if (kind === 'already_subscribed') {
        const recognition = await refreshSubscription()
        const confirmed = recognition.state.kind === 'premium_confirmed'

        track('purchase_failed', {
          ...purchaseProperties,
          outcome: 'already_subscribed',
        })
        setFeedback({
          message:
            confirmed
              ? 'Premium is already active on this app profile.'
              : 'This plan is already owned. Use Restore purchases to refresh access.',
          tone:
            confirmed ? 'success' : 'info',
        })
        return
      }

      reportError(caughtError)
      track('purchase_failed', {
        ...purchaseProperties,
        outcome: kind,
      })
      setFeedback({
        message:
          kind === 'product_unavailable'
            ? 'This plan is temporarily unavailable.'
            : 'Could not complete the purchase. Please try again.',
        tone: 'error',
      })
    } finally {
      finishAction()
    }
  }

  const handleRestore = async () => {
    if (!beginAction('restore')) {
      return
    }

    track('restore_started', {
      trigger,
      access_plan: subscriptionStatus.plan,
    })

    try {
      const result = await restoreSubscription()
      if (result.state.kind === 'premium_confirmed') {
        track('restore_completed', { trigger, premium_active: true })
        setFeedback({ message: 'Premium access has been restored.', tone: 'success' })
      } else if (result.state.kind === 'expired') {
        setFeedback({ message: 'Your previous subscription has expired.', tone: 'info' })
      } else if (result.state.kind === 'restore_no_active_entitlement') {
        setFeedback({
          message: 'No active subscription was found for this store account.',
          tone: 'info',
        })
      } else if (result.state.kind === 'store_premium_backend_pending') {
        setFeedback({ message: 'Purchase found. Verifying your AI access…', tone: 'info' })
      } else if (result.state.kind === 'binding_conflict') {
        setFeedback({
          message: 'This purchase is linked to another app profile. Contact support for help.',
          tone: 'error',
        })
      } else {
        setFeedback({
          message: 'Could not verify Premium access. Your last confirmed access was not changed.',
          tone: 'error',
        })
      }
    } catch (caughtError) {
      reportError(caughtError)
      track('restore_failed', { trigger })
      setFeedback({
        message: 'Could not restore purchases. Please try again.',
        tone: 'error',
      })
    } finally {
      finishAction()
    }
  }

  const handleRetryOfferings = async () => {
    if (!beginAction('retry_offerings')) {
      return
    }

    try {
      await refreshCustomerInfo()
      const offering = await refreshOfferings()

      if (!offering?.availablePackages.length) {
        setFeedback({
          message: 'Google Play plans are still unavailable. Please try again later.',
          tone: 'error',
        })
      }
    } finally {
      finishAction()
    }
  }

  const handleRetryUsage = async () => {
    if (!beginAction('retry_usage')) {
      return
    }

    try {
      await aiAccessQuery.refetch()
    } finally {
      finishAction()
    }
  }

  const handleManageSubscription = async () => {
    if (!beginAction('manage')) {
      return
    }

    track('subscription_manage_tapped', {
      trigger,
      source: 'paywall',
      has_management_url: Boolean(managementUrl),
    })

    try {
      if (!managementUrl || !(await Linking.canOpenURL(managementUrl))) {
        setFeedback({
          message:
            'Google Play subscription management is not available for this purchase yet.',
          tone: 'info',
        })
        return
      }

      await Linking.openURL(managementUrl)
    } catch {
      setFeedback({
        message: 'Could not open Google Play subscription management.',
        tone: 'error',
      })
    } finally {
      finishAction()
    }
  }

  const feedbackNode = feedback ? <PaywallFeedback {...feedback} /> : null

  return (
    <PaywallSheet
      closeDisabled={isBusy}
      onClose={(source) => closePaywall(source)}
      footer={
        shouldShowPurchaseFooter && selectedPackage && selectedPlan ? (
          <PaywallPurchaseFooter
            plan={selectedPlan}
            priceSummary={getPackagePriceSummary(
              selectedPackage,
              selectedPlan
            )}
            isPurchasing={pendingAction === 'purchase'}
            isRestoring={pendingAction === 'restore'}
            onPurchase={() => {
              void handlePurchase()
            }}
            onRestore={() => {
              void handleRestore()
            }}
            onLater={() => closePaywall('maybe_later')}
          />
        ) : undefined
      }
    >
      <PaywallHero isPremiumActive={isPremiumActive} />
      <PlanComparisonTable />
      <LegalLinks types={['privacy_policy', 'terms']} />
      <UsageProgress
        usage={usage}
        isLoading={aiAccessQuery.isLoading}
        hasError={aiAccessQuery.isError}
        isRetrying={pendingAction === 'retry_usage'}
        onRetry={() => {
          void handleRetryUsage()
        }}
      />

      {isPremiumActive ? (
        <PremiumActivePanel
          usageText={getRecipeSubscriptionAvailabilityText(subscriptionStatus)}
          currentPlan={currentPlan}
          feedback={feedbackNode}
          isManaging={pendingAction === 'manage'}
          isRestoring={pendingAction === 'restore'}
          onManage={() => {
            void handleManageSubscription()
          }}
          onRestore={() => {
            void handleRestore()
          }}
          onClose={() => closePaywall('premium_close')}
        />
      ) : plansLoading ? (
        <PaywallPlansLoading
          isRestoring={pendingAction === 'restore'}
          onRestore={() => {
            void handleRestore()
          }}
          onLater={() => closePaywall('maybe_later')}
        />
      ) : plansUnavailable ? (
        <PaywallUnavailable
          isRetrying={pendingAction === 'retry_offerings'}
          isRestoring={pendingAction === 'restore'}
          feedback={feedbackNode}
          onRetry={() => {
            void handleRetryOfferings()
          }}
          onRestore={() => {
            void handleRestore()
          }}
          onLater={() => closePaywall('maybe_later')}
        />
      ) : (
        <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text
              selectable
              style={[typography.heading, { color: colors.onSurface }]}
            >
              Choose your plan
            </Text>
            <Text
              selectable
              style={[typography.body, { color: colors.textMuted }]}
            >
              Prices come directly from Google Play. Cancel anytime in your
              Google Play subscriptions.
            </Text>
          </View>
          {packageMap.monthly ? (
            <PaywallPlanCard
              plan="monthly"
              priceSummary={getPackagePriceSummary(
                packageMap.monthly,
                'monthly'
              )}
              introOfferText={getIntroOfferText(packageMap.monthly)}
              selected={
                selectedPackage?.identifier === packageMap.monthly.identifier
              }
              disabled={isBusy}
              onPress={() =>
                handleSelectPackage(packageMap.monthly!, 'monthly')
              }
            />
          ) : null}
          {packageMap.yearly ? (
            <PaywallPlanCard
              plan="yearly"
              priceSummary={getPackagePriceSummary(
                packageMap.yearly,
                'yearly'
              )}
              introOfferText={getIntroOfferText(packageMap.yearly)}
              selected={
                selectedPackage?.identifier === packageMap.yearly.identifier
              }
              disabled={isBusy}
              onPress={() => handleSelectPackage(packageMap.yearly!, 'yearly')}
            />
          ) : null}
          {feedbackNode}
        </View>
      )}
    </PaywallSheet>
  )
}

function getCurrentPlanLabel(customerInfo: CustomerInfo | null) {
  const productIdentifier = getPremiumEntitlement(customerInfo)?.productIdentifier

  if (!productIdentifier) {
    return null
  }

  if (productIdentifier.startsWith(PAYWALL_YEARLY_PRODUCT_ID)) {
    return `${getPackagePlanLabel('yearly')} plan`
  }

  if (productIdentifier.startsWith(PAYWALL_MONTHLY_PRODUCT_ID)) {
    return `${getPackagePlanLabel('monthly')} plan`
  }

  return null
}
