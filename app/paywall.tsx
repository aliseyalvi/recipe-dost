import {
  getNormalizedSubscriptionStatus,
  getRecipeSubscriptionAvailabilityText,
} from '@/features/subscription/normalized-subscription-status'
import { type AiAccessState, getAiAccessState } from '@/lib/api/ai-access'
import { useAuth } from '@/providers/auth-provider'
import {
  getSubscriptionManagementUrl,
  isCustomerPremium,
  isRevenueCatCancellation,
  useRevenueCat,
} from '@/providers/revenuecat-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { AppBadge } from '@/ui/app-badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Linking, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function PaywallRoute() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { track } = usePostHog()
  const {
    isConfigured,
    isLoading,
    isPremium,
    customerInfo,
    packages,
    error,
    refreshCustomerInfo,
    refreshOfferings,
    purchasePackage,
    restorePurchases,
    syncPremiumEntitlement,
  } = useRevenueCat()
  const aiAccessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', user?.id, 'paywall'],
    queryFn: getAiAccessState,
  })
  const [purchasePackageId, setPurchasePackageId] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const managementUrl = getSubscriptionManagementUrl(customerInfo)
  const subscriptionStatus = getNormalizedSubscriptionStatus({
    aiAccess: aiAccessQuery.data,
    isAiAccessLoading: aiAccessQuery.isLoading,
    revenueCatState: {
      isPremium,
      isLoading,
    },
  })
  const isPremiumActive = subscriptionStatus.isPremium
  const monthlyPackage = useMemo(
    () => packages.find((item) =>
      item.product.identifier === 'recipe_dost_premium_monthly' ||
      item.product.identifier === 'recipe_dost_monthly'
    ) ??
      packages.find((item) => item.identifier.toLowerCase().includes('month')),
    [packages]
  )
  const yearlyPackage = useMemo(
    () => packages.find((item) =>
      item.product.identifier === 'recipe_dost_premium_yearly' ||
      item.product.identifier === 'recipe_dost_annual'
    ) ??
      packages.find((item) => item.identifier.toLowerCase().includes('annual')) ??
      packages.find((item) => item.identifier.toLowerCase().includes('year')),
    [packages]
  )
  const availablePackages = [monthlyPackage, yearlyPackage].filter(
    (item): item is PurchasesPackage => Boolean(item)
  )
  const hasPackages = availablePackages.length > 0
  const plansUnavailable =
    !isPremiumActive && isConfigured && !isLoading && !hasPackages
  const shouldShowPurchaseFooter =
    !isPremiumActive && isConfigured && !isLoading && hasPackages
  const selectedPackage =
    availablePackages.find((item) => item.identifier === selectedPackageId) ??
    yearlyPackage ??
    monthlyPackage ??
    null
  const selectedPackageLabel = selectedPackage
    ? getPackageLabel(selectedPackage, monthlyPackage, yearlyPackage)
    : null

  useEffect(() => {
    track('paywall_viewed', {
      source: 'paywall_route',
      configured: isConfigured,
      package_count: packages.length,
    })
  }, [isConfigured, packages.length, track])

  useEffect(() => {
    if (!isPremiumActive) {
      return
    }

    track('premium_paywall_active_viewed', {
      has_management_url: Boolean(managementUrl),
    })
  }, [isPremiumActive, managementUrl, track])

  useEffect(() => {
    if (!plansUnavailable) {
      return
    }

    track('paywall_plans_unavailable', {
      configured: isConfigured,
      has_revenuecat_error: Boolean(error),
    })
  }, [error, isConfigured, plansUnavailable, track])

  useEffect(() => {
    const preferredPackage = yearlyPackage ?? monthlyPackage

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
  }, [availablePackages, monthlyPackage, selectedPackageId, yearlyPackage])

  const handleRetry = async () => {
    setActionError(null)
    await refreshCustomerInfo()
    await refreshOfferings()
  }

  const handleManageSubscription = async () => {
    track('subscription_manage_tapped', {
      source: 'paywall',
      has_management_url: Boolean(managementUrl),
    })

    if (!managementUrl) {
      Alert.alert(
        'Manage / cancel subscription',
        'Subscription management is available for real Google Play subscriptions after launch. For Test Store purchases, manage the test customer in RevenueCat.'
      )
      return
    }

    const canOpenUrl = await Linking.canOpenURL(managementUrl)

    if (canOpenUrl) {
      await Linking.openURL(managementUrl)
      return
    }

    Alert.alert(
      'Manage / cancel subscription',
      'Subscription management is available for real Google Play subscriptions after launch. For Test Store purchases, manage the test customer in RevenueCat.'
    )
  }

  const handlePurchase = async (selectedPackage: PurchasesPackage) => {
    if (purchasePackageId || isRestoring) {
      return
    }

    setActionError(null)
    setPurchasePackageId(selectedPackage.identifier)
    track('purchase_started', {
      package_identifier: selectedPackage.identifier,
      product_identifier: selectedPackage.product.identifier,
    })

    try {
      const customerInfo = await purchasePackage(selectedPackage)
      const premiumActive = isCustomerPremium(customerInfo)

      if (premiumActive) {
        track('purchase_completed', {
          package_identifier: selectedPackage.identifier,
          product_identifier: selectedPackage.product.identifier,
          premium_active: true,
        })
        await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
        Alert.alert(
          'Premium active',
          'Premium is active with 100 AI recipe cards per month.'
        )
        router.back()
        return
      }

      setActionError('Purchase finished, but Premium is not active yet. Please try restore purchases.')
    } catch (caughtError) {
      if (isRevenueCatCancellation(caughtError)) {
        track('purchase_cancelled', {
          package_identifier: selectedPackage.identifier,
          product_identifier: selectedPackage.product.identifier,
        })
        return
      }

      track('purchase_failed', {
        package_identifier: selectedPackage.identifier,
        product_identifier: selectedPackage.product.identifier,
      })
      setActionError('Purchase could not be completed. Please try again.')
    } finally {
      setPurchasePackageId(null)
    }
  }

  const handleSelectPackage = (
    nextPackage: PurchasesPackage,
    cadence: 'monthly' | 'yearly'
  ) => {
    if (purchasePackageId || isRestoring) {
      return
    }

    setSelectedPackageId(nextPackage.identifier)
    track('premium_plan_card_tapped', {
      cadence,
      package_identifier: nextPackage.identifier,
      product_identifier: nextPackage.product.identifier,
    })
  }

  const handleRestore = async () => {
    if (purchasePackageId || isRestoring) {
      return
    }

    setActionError(null)
    setIsRestoring(true)
    track('restore_started')

    try {
      const restoredCustomerInfo = await restorePurchases()
      const refreshedCustomerInfo = await refreshCustomerInfo()
      const premiumActive = isCustomerPremium(
        refreshedCustomerInfo ?? restoredCustomerInfo
      )

      if (premiumActive) {
        track('restore_completed', { premium_active: true })
        await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
        void aiAccessQuery.refetch()
        Alert.alert('Premium active', 'Your subscription has been restored.')
        router.back()
        return
      }

      track('restore_completed', { premium_active: false })
      const synced = await syncPremiumEntitlement()
      await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
      const accessResult = await aiAccessQuery.refetch()
      const backendPremiumActive =
        accessResult.data?.plan === 'premium' ||
        accessResult.data?.premiumActive === true

      if (subscriptionStatus.isPremium || backendPremiumActive) {
        Alert.alert(
          'Premium access active',
          'Premium access is already active on this app profile.'
        )
        return
      }

      if (!synced) {
        Alert.alert(
          'Could not refresh subscription status',
          'Could not refresh subscription status. Your current app access was not changed.'
        )
        return
      }

      Alert.alert('No active subscription found.')
    } catch {
      track('restore_failed')
      setActionError('Restore could not be completed. Please try again.')
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen compact>
      <AppHeader
        eyebrow="PREMIUM"
        title={isPremiumActive ? 'Premium active' : 'Create recipe cards from reels'}
        subtitle={
          isPremiumActive
            ? 'Your Premium access is active on this app profile.'
            : 'Save links for free. Use AI when you want a clean recipe card.'
        }
      />

      {!isPremiumActive ? <BenefitComparison /> : null}
      <UsageCard
        aiAccess={aiAccessQuery.data}
        isLoading={aiAccessQuery.isLoading}
        subscriptionStatus={subscriptionStatus}
      />

      {isPremiumActive ? (
        <Card tone="warm">
          <AppBadge label="Premium active" tone="accent" />
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Premium active
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            {getRecipeSubscriptionAvailabilityText(subscriptionStatus)}
          </Text>
          <Button
            label="Manage / cancel subscription"
            fullWidth
            variant="outline"
            onPress={() => {
              void handleManageSubscription()
            }}
          />
          <Button
            label="Close"
            fullWidth
            variant="ghost"
            onPress={() => router.back()}
          />
        </Card>
      ) : null}

      {!isPremiumActive ? (
        !isConfigured ? (
          <ErrorState
            title="Plans unavailable right now"
            message="We could not load subscription plans. Please try again in a moment."
            retryLabel="Retry"
            onRetry={() => {
              void handleRetry()
            }}
          />
        ) : isLoading ? (
          <LoadingState message="Loading Premium plans..." />
        ) : plansUnavailable ? (
          <ErrorState
            title="Plans unavailable right now"
            message={error ?? 'We could not load subscription plans. Restore purchases still works if you already have Premium.'}
            retryLabel="Retry"
            onRetry={() => {
              void handleRetry()
            }}
            secondaryActionLabel={isRestoring ? 'Restoring...' : 'Restore purchases'}
            onSecondaryAction={() => {
              void handleRestore()
            }}
          />
        ) : (
          <Card>
            <Text selectable style={[typography.heading, { color: colors.text }]}>
              Choose a plan
            </Text>
            <Text selectable style={[typography.body, { color: colors.textMuted }]}>
              Select a Google Play plan. You can restore an existing purchase below.
            </Text>
            {monthlyPackage ? (
              <PlanCard
                label="Monthly"
                selectedPackage={monthlyPackage}
                selected={selectedPackageId === monthlyPackage.identifier}
                disabled={Boolean(purchasePackageId) || isRestoring}
                onPress={() => {
                  handleSelectPackage(monthlyPackage, 'monthly')
                }}
              />
            ) : null}
            {yearlyPackage ? (
              <PlanCard
                label="Yearly"
                badge="Best value"
                selectedPackage={yearlyPackage}
                selected={selectedPackageId === yearlyPackage.identifier}
                disabled={Boolean(purchasePackageId) || isRestoring}
                onPress={() => {
                  handleSelectPackage(yearlyPackage, 'yearly')
                }}
              />
            ) : null}
          </Card>
        )
      ) : null}

      {actionError ? (
        <Card tone="muted">
          <Text selectable style={[typography.body, { color: colors.warning }]}>
            {actionError}
          </Text>
        </Card>
      ) : null}

      {!isPremiumActive ? (
        <Button
          label="Maybe later"
          fullWidth
          variant="ghost"
          disabled={Boolean(purchasePackageId) || isRestoring}
          onPress={() => router.back()}
        />
      ) : null}
      {shouldShowPurchaseFooter ? <View style={{ height: 180 + insets.bottom }} /> : null}
      </Screen>

      {shouldShowPurchaseFooter ? (
        <StickyPurchaseFooter
          selectedPackageLabel={selectedPackageLabel}
          selectedPackagePrice={selectedPackage?.product.priceString ?? null}
          isPurchasing={Boolean(purchasePackageId)}
          isRestoring={isRestoring}
          isDisabled={!selectedPackage}
          bottomInset={insets.bottom}
          onPurchase={() => {
            if (selectedPackage) {
              void handlePurchase(selectedPackage)
            }
          }}
          onRestore={() => {
            void handleRestore()
          }}
        />
      ) : null}
    </View>
  )
}

function BenefitComparison() {
  const rows = [
    {
      label: 'Save recipe links',
      free: 'Included',
      premium: 'Included',
    },
    {
      label: 'Search your library',
      free: 'Included',
      premium: 'Included',
    },
    {
      label: 'AI recipe cards',
      free: '3 total',
      premium: '100/month',
    },
    {
      label: 'Recipe help',
      free: 'On 3 AI cards',
      premium: 'Urdu + English',
    },
    {
      label: 'Ingredients + steps',
      free: 'On 3 AI cards',
      premium: 'On 100/month',
    },
    {
      label: 'Grocery lists',
      free: 'From AI cards',
      premium: 'Included',
    },
    {
      label: 'Video support',
      free: 'Saved links',
      premium: 'Up to 2 min',
    },
    {
      label: 'Priority beta improvements',
      free: 'Not included',
      premium: 'Included',
    },
  ]

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
        Free vs Premium
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Save links and search your Library on either plan. AI recipe-card access is different.
        </Text>
      </View>
      <View
        style={{
          overflow: 'hidden',
          borderWidth: 1,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderColor: colors.border,
        }}
      >
        <ComparisonRow label="" free="Free" premium="Premium" header />
        {rows.map((row) => (
          <ComparisonRow key={row.label} {...row} />
        ))}
      </View>
    </View>
  )
}

function UsageCard({
  aiAccess,
  isLoading,
  subscriptionStatus,
}: {
  aiAccess: AiAccessState | undefined
  isLoading: boolean
  subscriptionStatus: ReturnType<typeof getNormalizedSubscriptionStatus>
}) {
  if (isLoading && !aiAccess) {
    return null
  }

  if (!aiAccess) {
    return null
  }

  const isPremium = subscriptionStatus.isPremium
  const limit = isPremium ? aiAccess.premiumMonthlyLimit : aiAccess.freeLimit
  const used = isPremium
    ? aiAccess.premiumMonthlySuccessfulUsed
    : aiAccess.freeSuccessfulUsed
  const reserved = isPremium
    ? aiAccess.premiumMonthlyActiveReserved
    : aiAccess.freeActiveReserved
  const remaining = isPremium
    ? aiAccess.premiumMonthlyRemainingToStart
    : aiAccess.freeRemainingToStart

  return (
    <Card tone="muted">
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        {isPremium ? 'Premium AI card usage' : 'Free AI card credit'}
      </Text>
      <Text selectable style={[typography.body, { color: colors.textMuted }]}>
        {isPremium
          ? `${remaining} of ${limit} AI recipe cards available this month.`
          : `${remaining} of ${limit} AI recipe cards available in total.`}
      </Text>
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {used}/{limit} successful AI recipe cards used
        {reserved > 0 ? `, ${reserved} currently processing` : ''}
      </Text>
    </Card>
  )
}

function ComparisonRow({
  label,
  free,
  premium,
  header = false,
}: {
  label: string
  free: string
  premium: string
  header?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        minHeight: header ? 42 : 56,
        borderBottomWidth: header ? 1 : 0,
        borderTopWidth: header ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: header ? colors.surfaceMuted : colors.surface,
      }}
    >
      <ComparisonText value={label} width={1.2} muted={!header} header={header} />
      <ComparisonText value={free} width={0.9} header={header} />
      <ComparisonText value={premium} width={1} accent header={header} />
    </View>
  )
}

function ComparisonText({
  value,
  width,
  muted = false,
  accent = false,
  header = false,
}: {
  value: string
  width: number
  muted?: boolean
  accent?: boolean
  header?: boolean
}) {
  return (
    <View
      style={{
        flex: width,
        justifyContent: 'center',
        borderLeftWidth: width === 1.2 ? 0 : 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      <Text
        selectable
        style={[
          typography.caption,
          {
            color: accent ? colors.accent : muted ? colors.textMuted : colors.text,
            fontWeight: header ? '800' : '500',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function StickyPurchaseFooter({
  selectedPackageLabel,
  selectedPackagePrice,
  isPurchasing,
  isRestoring,
  isDisabled,
  bottomInset,
  onPurchase,
  onRestore,
}: {
  selectedPackageLabel: string | null
  selectedPackagePrice: string | null
  isPurchasing: boolean
  isRestoring: boolean
  isDisabled: boolean
  bottomInset: number
  onPurchase: () => void
  onRestore: () => void
}) {
  const purchaseLabel = isPurchasing && selectedPackageLabel
    ? `Starting ${selectedPackageLabel}...`
    : selectedPackageLabel
      ? `Continue with ${selectedPackageLabel}`
      : 'Continue'

  return (
    <View
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        left: 0,
        gap: spacing.sm,
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: Math.max(bottomInset, spacing.md),
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Text selectable style={[typography.caption, { flex: 1, color: colors.textMuted }]}>
          {selectedPackageLabel ? `${selectedPackageLabel} plan` : 'Choose a plan'}
        </Text>
        {selectedPackagePrice ? (
          <Text selectable style={[typography.caption, { color: colors.text, fontWeight: '800' }]}>
            {selectedPackagePrice}
          </Text>
        ) : null}
      </View>
      <Button
        label={purchaseLabel}
        fullWidth
        variant="accent"
        disabled={isDisabled || isPurchasing || isRestoring}
        onPress={onPurchase}
      />
      <Button
        label={isRestoring ? 'Restoring purchases...' : 'Restore purchases'}
        fullWidth
        variant="ghost"
        disabled={isPurchasing || isRestoring}
        onPress={onRestore}
      />
    </View>
  )
}

function PlanCard({
  label,
  badge,
  selectedPackage,
  selected,
  disabled,
  onPress,
}: {
  label: string
  badge?: string
  selectedPackage: PurchasesPackage
  selected: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={`paywall-${label.toLowerCase()}-button`}
      style={({ pressed }) => ({
        gap: spacing.sm,
        borderWidth: 1,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accentSoft : colors.surfaceMuted,
        padding: spacing.lg,
        opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text selectable={false} style={[typography.heading, { color: colors.text }]}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {badge ? <AppBadge label={badge} tone="accent" /> : null}
          {selected ? (
            <View
              accessibilityLabel={`${label} selected`}
              style={{
                width: 12,
                height: 12,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
              }}
            />
          ) : null}
        </View>
      </View>
      <Text selectable={false} style={[typography.body, { color: colors.text }]}>
        {selectedPackage.product.priceString}
      </Text>
      <Text selectable={false} style={[typography.caption, { color: colors.textMuted }]}>
        100 AI recipe cards/month
      </Text>
    </Pressable>
  )
}

function getPackageLabel(
  selectedPackage: PurchasesPackage,
  monthlyPackage: PurchasesPackage | undefined,
  yearlyPackage: PurchasesPackage | undefined
) {
  if (yearlyPackage?.identifier === selectedPackage.identifier) {
    return 'Yearly'
  }

  if (monthlyPackage?.identifier === selectedPackage.identifier) {
    return 'Monthly'
  }

  return selectedPackage.identifier.toLowerCase().includes('year') ||
    selectedPackage.identifier.toLowerCase().includes('annual')
    ? 'Yearly'
    : 'Monthly'
}
