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
import { useQueryClient } from '@tanstack/react-query'
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Linking, Pressable, Text, View } from 'react-native'

const benefits = [
  '100 AI recipe cards per month',
  'Save recipe links free forever',
  'Urdu + English recipe help',
  'Grocery lists from generated recipes',
  'Premium support for future features',
]

export default function PaywallRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
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
  } = useRevenueCat()
  const [purchasePackageId, setPurchasePackageId] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const managementUrl = getSubscriptionManagementUrl(customerInfo)
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

  useEffect(() => {
    track('paywall_viewed', {
      source: 'paywall_route',
      configured: isConfigured,
      package_count: packages.length,
    })
  }, [isConfigured, packages.length, track])

  useEffect(() => {
    if (!isPremium) {
      return
    }

    track('premium_paywall_active_viewed', {
      has_management_url: Boolean(managementUrl),
    })
  }, [isPremium, managementUrl, track])

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
        'Manage subscription',
        'Subscription management is not available yet for this test purchase. You can manage real subscriptions from Google Play after launch.'
      )
      return
    }

    const canOpenUrl = await Linking.canOpenURL(managementUrl)

    if (canOpenUrl) {
      await Linking.openURL(managementUrl)
      return
    }

    Alert.alert(
      'Manage subscription',
      'Subscription management is not available yet for this test purchase. You can manage real subscriptions from Google Play after launch.'
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

  const handleRestore = async () => {
    if (purchasePackageId || isRestoring) {
      return
    }

    setActionError(null)
    setIsRestoring(true)
    track('restore_started')

    try {
      const customerInfo = await restorePurchases()
      const premiumActive = isCustomerPremium(customerInfo)

      if (premiumActive) {
        track('restore_completed', { premium_active: true })
        await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
        Alert.alert('Premium active', 'Your subscription has been restored.')
        router.back()
        return
      }

      track('restore_completed', { premium_active: false })
      Alert.alert('No active subscription found.')
    } catch {
      track('restore_failed')
      setActionError('Restore could not be completed. Please try again.')
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Screen compact>
      <AppHeader
        eyebrow="Premium"
        title={isPremium ? 'Premium active' : 'Upgrade to Recipe Dost Premium'}
        subtitle={
          isPremium
            ? 'Your Premium plan is active on this device.'
            : 'Create up to 100 AI recipe cards per month from reels and shorts.'
        }
      />

      {!isPremium ? (
        <Card tone="warm">
        <View style={{ gap: spacing.sm }}>
          {benefits.map((benefit) => (
            <View
              key={benefit}
              style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                  marginTop: 8,
                }}
              />
              <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>
                {benefit}
              </Text>
            </View>
          ))}
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Videos up to 2 minutes are supported in this beta.
          </Text>
        </View>
        </Card>
      ) : null}

      {isPremium ? (
        <Card tone="warm">
          <AppBadge label="Premium active" tone="accent" />
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Premium active
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            100 AI recipe cards/month
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Videos up to 2 minutes are supported in this beta.
          </Text>
          <Button
            label="Manage subscription"
            fullWidth
            variant="secondary"
            onPress={() => {
              void handleManageSubscription()
            }}
          />
        </Card>
      ) : null}

      {!isPremium ? (
        !isConfigured ? (
          <ErrorState
            title="Premium plans unavailable"
            message="Premium plans are not available right now. Please try again later."
            retryLabel="Retry"
            onRetry={() => {
              void handleRetry()
            }}
          />
        ) : isLoading ? (
          <LoadingState message="Loading Premium plans..." />
        ) : !hasPackages ? (
          <ErrorState
            title="Premium plans unavailable"
            message={error ?? 'Premium plans are not available right now. Please try again later.'}
            retryLabel="Retry"
            onRetry={() => {
              void handleRetry()
            }}
          />
        ) : (
          <Card>
            <Text selectable style={[typography.heading, { color: colors.text }]}>
              Choose a plan
            </Text>
            {monthlyPackage ? (
              <PlanCard
                label="Monthly"
                selectedPackage={monthlyPackage}
                isLoading={purchasePackageId === monthlyPackage.identifier}
                disabled={Boolean(purchasePackageId) || isRestoring}
                onPress={() => {
                  track('premium_plan_card_tapped', {
                    cadence: 'monthly',
                    package_identifier: monthlyPackage.identifier,
                    product_identifier: monthlyPackage.product.identifier,
                  })
                  void handlePurchase(monthlyPackage)
                }}
              />
            ) : null}
            {yearlyPackage ? (
              <PlanCard
                label="Yearly"
                badge="Best value"
                selectedPackage={yearlyPackage}
                isLoading={purchasePackageId === yearlyPackage.identifier}
                disabled={Boolean(purchasePackageId) || isRestoring}
                onPress={() => {
                  track('premium_plan_card_tapped', {
                    cadence: 'yearly',
                    package_identifier: yearlyPackage.identifier,
                    product_identifier: yearlyPackage.product.identifier,
                  })
                  void handlePurchase(yearlyPackage)
                }}
              />
            ) : null}
            <Button
              label={isRestoring ? 'Restoring...' : 'Restore purchases'}
              fullWidth
              variant="secondary"
              disabled={Boolean(purchasePackageId) || isRestoring}
              onPress={() => {
                void handleRestore()
              }}
            />
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

      <Button
        label={isPremium ? 'Close' : 'Maybe later'}
        fullWidth
        variant="ghost"
        disabled={Boolean(purchasePackageId) || isRestoring}
        onPress={() => router.back()}
      />
    </Screen>
  )
}

function PlanCard({
  label,
  badge,
  selectedPackage,
  isLoading,
  disabled,
  onPress,
}: {
  label: string
  badge?: string
  selectedPackage: PurchasesPackage
  isLoading: boolean
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
        borderColor: label === 'Yearly' ? colors.accent : colors.border,
        backgroundColor: label === 'Yearly' ? colors.accentSoft : colors.surfaceMuted,
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
        {badge ? <AppBadge label={badge} tone="accent" /> : null}
      </View>
      <Text selectable={false} style={[typography.body, { color: colors.text }]}>
        {selectedPackage.product.priceString}
      </Text>
      <Text selectable={false} style={[typography.caption, { color: colors.textMuted }]}>
        {isLoading
          ? `Starting ${label}...`
          : '100 AI recipe cards/month'}
      </Text>
    </Pressable>
  )
}
