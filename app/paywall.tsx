import {
  isCustomerPremium,
  isRevenueCatCancellation,
  useRevenueCat,
} from '@/providers/revenuecat-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, radius, spacing, typography } from '@/theme'
import { AppHeader } from '@/ui/app-header'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { useQueryClient } from '@tanstack/react-query'
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Text, View } from 'react-native'

const benefits = [
  'Generate unlimited AI recipe cards',
  'Save recipe links free forever',
  'Turn reels and shorts into ingredients and steps',
  'Urdu + English recipe help',
  'Grocery lists from recipes',
]

export default function PaywallRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { track } = usePostHog()
  const {
    isConfigured,
    isLoading,
    isPremium,
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
  const monthlyPackage = useMemo(
    () => packages.find((item) => item.product.identifier === 'recipe_dost_premium_monthly') ??
      packages.find((item) => item.identifier.toLowerCase().includes('month')),
    [packages]
  )
  const yearlyPackage = useMemo(
    () => packages.find((item) => item.product.identifier === 'recipe_dost_premium_yearly') ??
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

  const handleRetry = async () => {
    setActionError(null)
    await refreshCustomerInfo()
    await refreshOfferings()
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
        Alert.alert('Premium active', 'Unlimited AI recipes are unlocked on this device.')
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
        title="Unlock unlimited AI recipes"
        subtitle="Turn recipe reels and shorts into clean recipe cards whenever you need."
      />

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
        </View>
      </Card>

      {isPremium ? (
        <Card tone="muted">
          <Text selectable style={[typography.heading, { color: colors.text }]}>
            Premium active
          </Text>
          <Text selectable style={[typography.body, { color: colors.textMuted }]}>
            Your local RevenueCat entitlement is active.
          </Text>
          <Button label="Close" fullWidth onPress={() => router.back()} />
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
              <PackageButton
                label="Monthly"
                selectedPackage={monthlyPackage}
                isLoading={purchasePackageId === monthlyPackage.identifier}
                disabled={Boolean(purchasePackageId) || isRestoring}
                onPress={() => {
                  void handlePurchase(monthlyPackage)
                }}
              />
            ) : null}
            {yearlyPackage ? (
              <PackageButton
                label="Yearly"
                selectedPackage={yearlyPackage}
                isLoading={purchasePackageId === yearlyPackage.identifier}
                disabled={Boolean(purchasePackageId) || isRestoring}
                onPress={() => {
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

function PackageButton({
  label,
  selectedPackage,
  isLoading,
  disabled,
  onPress,
}: {
  label: string
  selectedPackage: PurchasesPackage
  isLoading: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Button
      label={
        isLoading
          ? `Starting ${label}...`
          : `${label} - ${selectedPackage.product.priceString}`
      }
      fullWidth
      disabled={disabled}
      onPress={onPress}
      variant={label === 'Yearly' ? 'accent' : 'primary'}
      testID={`paywall-${label.toLowerCase()}-button`}
    />
  )
}
