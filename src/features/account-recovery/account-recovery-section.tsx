import { maskAccountEmail } from '@/features/account-recovery/account-recovery'
import {
  SettingsDivider,
  SettingsFeedback,
  SettingsPanel,
  SettingsRow,
  SettingsSection,
} from '@/features/settings/settings-presentation'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { spacing } from '@/theme'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

export function AccountRecoverySection() {
  const {
    user,
    accountError,
    subscriptionRefreshPending,
    signOut,
  } = useAuth()
  const { trackEvent } = usePostHog()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const isAnonymous = Boolean(user?.is_anonymous)
  const isLinked = Boolean(user && !user.is_anonymous)
  const isSignedOut = !user

  const openAccountAccess = (mode: 'secure' | 'recover') => {
    trackEvent('account_recovery_form_opened', {
      mode: mode === 'secure' ? 'link' : 'sign_in',
    })
    router.push({
      pathname: '/account-access',
      params: { mode },
    })
  }

  const handleSignOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    setFeedback(null)
    try {
      await signOut()
      setFeedback('Signed out. Your remote Recipe Dost data was not deleted.')
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError))
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <SettingsSection title="Account Recovery">
      <SettingsPanel>
        {isAnonymous ? (
          <>
            <SettingsRow
              icon="profile"
              title="Guest account"
              subtitle="Secure this account so recipes and Premium access can be recovered after reinstall."
            />
            <SettingsDivider />
            <SettingsRow
              icon="profile"
              title="Secure this account"
              subtitle="Keep this Recipe Dost account and add recovery details."
              onPress={() => {
                openAccountAccess('secure')
              }}
            />
            <SettingsDivider />
            <SettingsRow
              icon="restore"
              title="Sign in to recover account"
              subtitle="Already secured? Switch accounts without merging guest data."
              onPress={() => {
                openAccountAccess('recover')
              }}
            />
          </>
        ) : null}

        {isLinked ? (
          <>
            <SettingsRow
              icon="profile"
              title="Account secured"
              subtitle="Recipes and Premium access can be recovered after reinstall."
              value={maskAccountEmail(user?.email)}
            />
            <SettingsDivider />
            <SettingsRow
              icon="delete"
              title="Sign out"
              subtitle="Keep remote data and onboarding completion on this device."
              busy={isSigningOut}
              disabled={isSigningOut}
              onPress={() => {
                void handleSignOut()
              }}
            />
          </>
        ) : null}

        {isSignedOut ? (
          <SettingsRow
            icon="restore"
            title="Sign in to recover account"
            subtitle="Recover recipes, grocery data, generation history, and Premium access."
            onPress={() => {
              openAccountAccess('recover')
            }}
          />
        ) : null}

        {feedback || accountError || subscriptionRefreshPending ? (
          <View style={{ paddingBottom: spacing.lg }}>
            <SettingsFeedback
              message={
                feedback ??
                accountError ??
                'Account recovered. Premium refresh is pending; use Restore purchases to retry.'
              }
              tone={accountError ? 'error' : 'info'}
            />
          </View>
        ) : null}
      </SettingsPanel>
    </SettingsSection>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The account action could not be completed. Please retry.'
}
