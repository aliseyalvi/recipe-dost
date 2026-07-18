import {
  DevIdentityPanel,
  shouldShowDevIdentityPanel,
} from '@/features/dev-tools/dev-identity-panel'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { getSecondaryRecipeLanguage } from '@/features/settings/secondary-recipe-language'
import { getPaywallHref } from '@/features/paywall/paywall-model'
import {
  ProfileSettingsCard,
  SettingsDivider,
  SettingsFeedback,
  SettingsHeader,
  SettingsPanel,
  SettingsRow,
  SettingsSection,
  SubscriptionStatusCard,
  type SettingsFeedbackTone,
} from '@/features/settings/settings-presentation'
import {
  type NormalizedSubscriptionStatus,
  getNormalizedSubscriptionStatus,
} from '@/features/subscription/normalized-subscription-status'
import { getAiAccessState } from '@/lib/api/ai-access'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { reportError } from '@/lib/observability/sentry'
import {
  getPremiumEntitlement,
  getSubscriptionManagementUrl,
  isCustomerPremium,
  useRevenueCat,
} from '@/providers/revenuecat-provider'
import { spacing } from '@/theme'
import { Screen } from '@/ui/screen'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { CustomerInfo } from '@revenuecat/purchases-typescript-internal'
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Linking, View } from 'react-native'
import { getLegalUrl } from '@/config/legal'
import { openLegalUrl } from '@/features/legal/legal-links'

type SubscriptionAction = 'manage' | 'refresh' | 'restore'

type ActionFeedback = {
  message: string
  tone: SettingsFeedbackTone
}

export default function SettingsRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const {
    isControlledDevTest,
    sendControlledTestEvent,
    track,
  } = usePostHog()
  const profileQuery = useUserProfileQuery()
  const {
    isConfigured: isRevenueCatConfigured,
    isLoading: isRevenueCatLoading,
    isReadyForCurrentUser: isRevenueCatReadyForCurrentUser,
    isPremium,
    customerInfo,
    refreshCustomerInfo,
    restorePurchases,
    syncPremiumEntitlement,
  } = useRevenueCat()
  const [pendingSubscriptionAction, setPendingSubscriptionAction] =
    useState<SubscriptionAction | null>(null)
  const [actionFeedback, setActionFeedback] =
    useState<ActionFeedback | null>(null)
  const [isSendingPostHogTest, setIsSendingPostHogTest] = useState(false)
  const [postHogTestSent, setPostHogTestSent] = useState(false)
  const mountedRef = useRef(false)
  const subscriptionActionRef = useRef<SubscriptionAction | null>(null)
  const didAttemptPremiumSyncRef = useRef(false)
  const lastBackendPremiumAccessRef =
    useRef<Awaited<ReturnType<typeof getAiAccessState>> | null>(null)
  const aiAccessQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['ai-access-state', user?.id, 'settings'],
    queryFn: getAiAccessState,
  })
  const showDeveloperSection = shouldShowDevIdentityPanel(aiAccessQuery.data)
  const userIdentifier = user?.id ?? 'Starting profile…'
  const selectedLanguage = getSecondaryRecipeLanguage(
    profileQuery.data?.secondary_recipe_language_code
  )
  const managementUrl = getSubscriptionManagementUrl(customerInfo)
  const subscriptionDetailText = getSubscriptionDetailText(customerInfo)
  const subscriptionStatus = getNormalizedSubscriptionStatus({
    aiAccess: aiAccessQuery.data,
    previousAiAccess: lastBackendPremiumAccessRef.current,
    isAiAccessLoading: aiAccessQuery.isLoading,
    revenueCatState: {
      isPremium,
      isLoading: isRevenueCatLoading,
    },
  })
  const hasPendingSubscriptionAction = pendingSubscriptionAction !== null
  const shouldShowUpgrade =
    !subscriptionStatus.isPremium &&
    subscriptionStatus.sourceOfTruth !== 'loading'
  const shouldShowManage =
    subscriptionStatus.isPremium && !subscriptionStatus.needsSync

  const handlePostHogTest = async () => {
    if (!isControlledDevTest || isSendingPostHogTest || postHogTestSent) return
    setIsSendingPostHogTest(true)
    setPostHogTestSent(true)
    try {
      const sent = await sendControlledTestEvent()
      setActionFeedback({
        message: sent
          ? 'One privacy-safe PostHog test event was flushed.'
          : 'PostHog test sending is disabled.',
        tone: sent ? 'success' : 'info',
      })
    } catch {
      setActionFeedback({
        message: 'The one-time PostHog test event could not be flushed.',
        tone: 'error',
      })
    } finally {
      setIsSendingPostHogTest(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    track('settings_screen_viewed')
  }, [track])

  useEffect(() => {
    if (
      aiAccessQuery.data?.plan === 'premium' ||
      aiAccessQuery.data?.premiumActive === true
    ) {
      lastBackendPremiumAccessRef.current = aiAccessQuery.data
    }
  }, [aiAccessQuery.data])

  useEffect(() => {
    if (!subscriptionStatus.needsSync || didAttemptPremiumSyncRef.current) {
      return
    }

    didAttemptPremiumSyncRef.current = true

    const syncBackendAccess = async () => {
      await syncPremiumEntitlement()
      await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
      if (mountedRef.current) {
        await aiAccessQuery.refetch()
      }
    }

    void syncBackendAccess()
  }, [
    aiAccessQuery,
    queryClient,
    subscriptionStatus.needsSync,
    syncPremiumEntitlement,
  ])

  const beginSubscriptionAction = (action: SubscriptionAction) => {
    if (subscriptionActionRef.current) {
      return false
    }

    subscriptionActionRef.current = action
    setPendingSubscriptionAction(action)
    setActionFeedback(null)
    return true
  }

  const finishSubscriptionAction = () => {
    subscriptionActionRef.current = null
    if (mountedRef.current) {
      setPendingSubscriptionAction(null)
    }
  }

  const showActionFeedback = (
    message: string,
    tone: SettingsFeedbackTone = 'info'
  ) => {
    if (mountedRef.current) {
      setActionFeedback({ message, tone })
    }
  }

  const handleRestorePurchases = async () => {
    if (!beginSubscriptionAction('restore')) {
      return
    }

    if (!isRevenueCatReadyForCurrentUser) {
      track('restore_failed', { source: 'settings', reason: 'not_ready' })
      showActionFeedback(
        'Checking your app profile. Please try Restore again in a moment.'
      )
      finishSubscriptionAction()
      return
    }

    track('restore_started', { source: 'settings' })

    try {
      const restoredCustomerInfo = await restorePurchases()
      const refreshedCustomerInfo = await refreshCustomerInfo()
      const premiumActive = isCustomerPremium(
        refreshedCustomerInfo ?? restoredCustomerInfo
      )

      track('restore_completed', {
        source: 'settings',
        premium_active: premiumActive,
      })

      const synced = await syncPremiumEntitlement()
      await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
      const accessResult = await aiAccessQuery.refetch()
      if (accessResult.error) {
        reportError(accessResult.error)
      }
      const backendPremiumActive =
        accessResult.data?.plan === 'premium' ||
        accessResult.data?.premiumActive === true

      if (premiumActive) {
        showActionFeedback(
          'Your Premium subscription has been restored.',
          'success'
        )
      } else if (subscriptionStatus.isPremium || backendPremiumActive) {
        showActionFeedback(
          'Premium access is already active on this app profile.',
          'success'
        )
      } else if (!synced) {
        showActionFeedback(
          'Could not refresh subscription status. Your current app access was not changed.',
          'error'
        )
      } else {
        showActionFeedback('No active subscription was found.')
      }
    } catch (caughtError) {
      reportError(caughtError)
      track('restore_failed', { source: 'settings' })
      showActionFeedback(
        'Could not restore purchases. Please try again.',
        'error'
      )
    } finally {
      finishSubscriptionAction()
    }
  }

  const handleManageSubscription = async () => {
    if (!beginSubscriptionAction('manage')) {
      return
    }

    track('subscription_manage_tapped', {
      source: 'settings',
      has_management_url: Boolean(managementUrl),
    })

    try {
      if (!managementUrl) {
        showActionFeedback(
          'Store subscription management is not available for this test purchase. Real Google Play subscriptions provide a management link.'
        )
        return
      }

      const canOpenUrl = await Linking.canOpenURL(managementUrl)

      if (!canOpenUrl) {
        showActionFeedback(
          'Could not open store subscription settings on this device.',
          'error'
        )
        return
      }

      await Linking.openURL(managementUrl)
    } catch {
      showActionFeedback(
        'Could not open store subscription settings on this device.',
        'error'
      )
    } finally {
      finishSubscriptionAction()
    }
  }

  const handleRefreshPremiumStatus = async () => {
    if (!beginSubscriptionAction('refresh')) {
      return
    }

    track('settings_subscription_refresh_started')

    if (!isRevenueCatReadyForCurrentUser) {
      showActionFeedback(
        'Checking your app profile. Please try Refresh status again in a moment.'
      )
      finishSubscriptionAction()
      return
    }

    try {
      const nextInfo = isRevenueCatConfigured
        ? await refreshCustomerInfo()
        : customerInfo

      if (nextInfo || !isRevenueCatConfigured) {
        const synced = await syncPremiumEntitlement()
        await queryClient.invalidateQueries({ queryKey: ['ai-access-state'] })
        if (mountedRef.current) {
          await aiAccessQuery.refetch()
        }

        if (!synced) {
          showActionFeedback(
            'Could not refresh subscription status. Your current app access was not changed.',
            'error'
          )
          return
        }

        track('settings_subscription_refresh_completed')
        showActionFeedback('Premium and AI access status refreshed.', 'success')
        return
      }

      showActionFeedback(
        'Could not refresh subscription status. Your current app access was not changed.',
        'error'
      )
    } catch {
      showActionFeedback(
        'Could not refresh subscription status. Your current app access was not changed.',
        'error'
      )
    } finally {
      finishSubscriptionAction()
    }
  }

  const handleOpenSupport = async () => {
    const opened = await openLegalUrl('support')
    if (!opened) {
      showActionFeedback('Could not open Recipe Dost support. Please try again.', 'error')
    }
  }

  return (
    <Screen tabBarPadding>
      <SettingsHeader />

      <View style={{ gap: spacing.sectionGap }}>
        <SettingsSection title="Profile">
          <ProfileSettingsCard identifier={userIdentifier} />
        </SettingsSection>

        <SettingsSection title="Subscription">
          <SettingsPanel featured>
            <SubscriptionStatusCard
              detailText={shouldShowManage ? subscriptionDetailText : null}
              errorMessage={
                aiAccessQuery.error
                  ? 'Could not load the latest AI access state. Use Refresh status to try again.'
                  : null
              }
              status={subscriptionStatus}
            />
            {actionFeedback ? (
              <View style={{ paddingBottom: spacing.lg }}>
                <SettingsFeedback {...actionFeedback} />
              </View>
            ) : null}
            {shouldShowUpgrade ? (
              <>
                <SettingsDivider />
                <SettingsRow
                  icon="upgrade"
                  title="Upgrade to Premium"
                  subtitle="100 AI recipe cards each month."
                  disabled={hasPendingSubscriptionAction}
                  onPress={() => {
                    track('settings_row_tapped', {
                      row: 'upgrade_to_premium',
                      premium_active: subscriptionStatus.isPremium,
                    })
                    router.push(getPaywallHref('settings_upgrade'))
                  }}
                  accessibilityHint="Opens Premium plans"
                />
              </>
            ) : null}
            {shouldShowManage ? (
              <>
                <SettingsDivider />
                <SettingsRow
                  icon="manage"
                  title="Manage subscription"
                  subtitle={
                    managementUrl
                      ? 'Open Google Play subscription settings.'
                      : 'Store management is unavailable for this test purchase.'
                  }
                  busy={pendingSubscriptionAction === 'manage'}
                  disabled={
                    hasPendingSubscriptionAction &&
                    pendingSubscriptionAction !== 'manage'
                  }
                  onPress={() => {
                    void handleManageSubscription()
                  }}
                  accessibilityHint="Opens store subscription settings when available"
                />
              </>
            ) : null}
            <SettingsDivider />
            <SettingsRow
              icon="restore"
              title="Restore purchases"
              subtitle={
                isRevenueCatLoading
                  ? 'Checking Premium status…'
                  : 'Restore an active subscription for this app profile.'
              }
              busy={pendingSubscriptionAction === 'restore'}
              disabled={
                hasPendingSubscriptionAction &&
                pendingSubscriptionAction !== 'restore'
              }
              onPress={() => {
                void handleRestorePurchases()
              }}
            />
            <SettingsDivider />
            <SettingsRow
              icon="refresh"
              title="Refresh status"
              subtitle="Check the latest store and AI access status."
              busy={pendingSubscriptionAction === 'refresh'}
              disabled={
                hasPendingSubscriptionAction &&
                pendingSubscriptionAction !== 'refresh'
              }
              onPress={() => {
                void handleRefreshPremiumStatus()
              }}
            />
          </SettingsPanel>
        </SettingsSection>

        <SettingsSection title="Recipe Preferences">
          <SettingsPanel>
            <SettingsRow
              icon="language"
              title="Secondary recipe language"
              subtitle="Used for secondary AI recipe explanations."
              value={`${selectedLanguage.label} / ${selectedLanguage.nativeLabel}`}
              onPress={() => {
                track('settings_row_tapped', {
                  row: 'secondary_recipe_language',
                })
                router.push('/settings/secondary-language')
              }}
            />
          </SettingsPanel>
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SettingsPanel>
            <SettingsRow
              icon="theme"
              title="Theme"
              subtitle="Recipe Dost currently uses its dark editorial theme."
              value="Dark"
            />
          </SettingsPanel>
        </SettingsSection>

        <SettingsSection title="Privacy & Data">
          <SettingsPanel>
            <SettingsRow
              icon="privacy"
              title="Privacy & data usage"
              subtitle="Review how Recipe Dost uses app and recipe data."
              onPress={() => {
                track('settings_row_tapped', {
                  row: 'privacy_data_usage',
                })
                router.push('/settings/privacy-data')
              }}
            />
            <SettingsDivider />
            <SettingsRow
              icon="delete"
              title="Delete account & data"
              subtitle="Request deletion of your Recipe Dost profile and saved data."
              danger
              onPress={() => {
                track('settings_row_tapped', {
                  row: 'delete_account_data',
                })
                router.push('/settings/delete-account-data')
              }}
              accessibilityHint="Opens deletion request information"
            />
          </SettingsPanel>
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingsPanel>
            <SettingsRow
              icon="support"
              title="Contact support"
              subtitle={getLegalUrl('support') ? 'Open Recipe Dost support in your browser.' : 'Support URL is not configured for this build.'}
              disabled={!getLegalUrl('support')}
              onPress={() => { void handleOpenSupport() }}
            />
            <SettingsDivider />
            <SettingsRow
              icon="version"
              title="App version"
              subtitle="Installed Recipe Dost version and Android build."
              value={getAppVersionLabel()}
            />
          </SettingsPanel>
        </SettingsSection>

        {showDeveloperSection ? (
          <SettingsSection title="Developer">
            <View style={{ gap: spacing.md }}>
              <SettingsPanel>
                <SettingsRow
                  icon="developer"
                  title="Role"
                  subtitle={
                    aiAccessQuery.data?.role ??
                    (__DEV__ ? 'Development' : 'Unknown')
                  }
                />
                <SettingsDivider />
                <SettingsRow
                  icon="developer"
                  title="AI access"
                  subtitle={
                    aiAccessQuery.data
                      ? getDeveloperAccessLabel(aiAccessQuery.data)
                      : aiAccessQuery.isLoading
                        ? 'Loading access'
                        : 'Access unavailable'
                  }
                />
                <SettingsDivider />
                <SettingsRow
                  icon="developer"
                  title="RevenueCat"
                  subtitle={getDeveloperSubscriptionLabel(
                    subscriptionStatus,
                    isRevenueCatConfigured
                  )}
                />
                {isControlledDevTest ? (
                  <>
                    <SettingsDivider />
                    <SettingsRow
                      icon="developer"
                      title="Send PostHog test event"
                      subtitle="Sends and flushes one safe diagnostics event for this screen visit."
                      disabled={isSendingPostHogTest || postHogTestSent}
                      busy={isSendingPostHogTest}
                      value={postHogTestSent ? 'Sent once' : undefined}
                      onPress={() => {
                        void handlePostHogTest()
                      }}
                      accessibilityHint="Sends one controlled development analytics event"
                    />
                  </>
                ) : null}
              </SettingsPanel>
              <DevIdentityPanel />
            </View>
          </SettingsSection>
        ) : null}
      </View>
    </Screen>
  )
}

function getAppVersionLabel() {
  const version =
    Constants.expoConfig?.version ?? Application.nativeApplicationVersion
  const build =
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Application.nativeBuildVersion

  if (!version) {
    return build ? `Build ${build}` : 'Unavailable'
  }

  return build ? `${version} (${build})` : version
}

function getSubscriptionDetailText(customerInfo: CustomerInfo | null) {
  const entitlement = getPremiumEntitlement(customerInfo)
  const planLabel = getPlanLabel(entitlement?.productIdentifier)

  if (!entitlement?.expirationDate) {
    return `${planLabel} · Subscription is managed by the store.`
  }

  const formattedDate = formatSubscriptionDate(entitlement.expirationDate)

  if (!formattedDate) {
    return `${planLabel} · Subscription is managed by the store.`
  }

  return entitlement.willRenew
    ? `${planLabel} · Renews on ${formattedDate}`
    : `${planLabel} · Access until ${formattedDate}`
}

function getPlanLabel(productId: string | null | undefined) {
  const normalizedProductId = productId?.toLowerCase() ?? ''

  if (normalizedProductId.includes('monthly')) {
    return 'Monthly plan'
  }

  if (
    normalizedProductId.includes('yearly') ||
    normalizedProductId.includes('annual')
  ) {
    return 'Yearly plan'
  }

  return 'Premium plan'
}

function formatSubscriptionDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getDeveloperAccessLabel(access: {
  premiumActive: boolean
  isTestUser: boolean
  remaining: number | null
  reason: string
}) {
  if (access.premiumActive) {
    return 'Premium'
  }

  if (access.isTestUser) {
    return 'Tester'
  }

  if (access.reason === 'limit_reached') {
    return 'Limit reached'
  }

  return access.remaining === null
    ? 'No limit set'
    : `${access.remaining} remaining`
}

function getDeveloperSubscriptionLabel(
  status: NormalizedSubscriptionStatus,
  isRevenueCatConfigured: boolean
) {
  if (!isRevenueCatConfigured) {
    return 'Not configured'
  }

  return `${status.statusTitle} (${status.sourceOfTruth})`
}
