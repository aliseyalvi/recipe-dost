import { SettingsFeedback, SettingsPanel } from '@/features/settings/settings-presentation'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type AccountAccessMode = 'secure' | 'recover'

export function AccountAccessScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>()
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode
  const mode: AccountAccessMode = rawMode === 'secure' ? 'secure' : 'recover'

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: mode === 'secure' ? 'Secure account' : 'Recover account',
        }}
      />
      <SafeAreaView
        edges={['bottom']}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              padding: spacing.xl,
              paddingBottom: spacing.xxl,
            }}
          >
            <MagicLinkFlow key={mode} mode={mode} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}

function MagicLinkFlow({ mode }: { mode: AccountAccessMode }) {
  const router = useRouter()
  const { authReadiness, requestAccountLink, requestRecoveryLink } = useAuth()
  const { trackEvent } = usePostHog()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const authIsPreparing =
    authReadiness === 'initializing' || authReadiness === 'recovering'

  useEffect(() => {
    trackEvent('account_recovery_form_opened', {
      mode: mode === 'secure' ? 'link' : 'sign_in',
    })
  }, [mode, trackEvent])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1_000)
    return () => {
      clearInterval(timer)
    }
  }, [cooldownSeconds])

  const sendLink = async (confirmGuestSwitch = false) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setFeedback('Enter a valid email address.')
      return
    }
    if (isSubmitting || authIsPreparing) return
    setIsSubmitting(true)
    setFeedback(null)

    try {
      if (mode === 'secure') {
        await requestAccountLink(normalizedEmail)
      } else {
        const result = await requestRecoveryLink({
          email: normalizedEmail,
          confirmGuestSwitch,
        })
        if (result.requiresGuestSwitchConfirmation) {
          Alert.alert(
            'Switch away from guest data?',
            'This guest account already has saved Recipe Dost data. Signing in will switch to the other account without merging or deleting either account.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Switch account',
                style: 'destructive',
                onPress: () => {
                  void sendLink(true)
                },
              },
            ]
          )
          return
        }
      }

      setEmail(normalizedEmail)
      setSent(true)
      setCooldownSeconds(60)
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = mode === 'secure' ? 'Secure your account' : 'Recover your account'
  const explanation =
    mode === 'secure'
      ? 'Email a secure link while preserving this same Recipe Dost account, recipes, and Premium access.'
      : 'Email a sign-in link to recover your saved Recipe Dost account.'

  return (
    <View style={{ gap: spacing.xl }}>
      <AccountAccessHeading title={title} explanation={explanation} />
      <SettingsPanel>
        <View style={{ gap: spacing.lg, paddingVertical: spacing.lg }}>
          {!sent ? (
            <>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                editable={!isSubmitting && !authIsPreparing}
                returnKeyType="send"
                onSubmitEditing={() => {
                  void sendLink()
                }}
              />
              <Button
                label={
                  isSubmitting
                    ? 'Sending link…'
                    : authIsPreparing
                      ? 'Preparing account…'
                    : mode === 'secure'
                      ? 'Send secure link'
                      : 'Send sign-in link'
                }
                disabled={isSubmitting || authIsPreparing}
                fullWidth
                onPress={() => {
                  void sendLink()
                }}
              />
            </>
          ) : (
            <>
              <Text
                accessibilityRole="header"
                selectable
                style={[typography.heading, { color: colors.onSurface }]}
              >
                Check your email
              </Text>
              <Text
                selectable
                style={[typography.body, { color: colors.textMuted }]}
              >
                Open the link sent to {email} on this device.
              </Text>
              <Button
                label={
                  cooldownSeconds > 0
                    ? `Resend available in ${cooldownSeconds}s`
                    : isSubmitting
                      ? 'Sending link…'
                      : 'Resend link'
                }
                variant="ghost"
                disabled={isSubmitting || authIsPreparing || cooldownSeconds > 0}
                fullWidth
                onPress={() => {
                  void sendLink(true)
                }}
              />
              <Button
                label="Change email"
                variant="ghost"
                disabled={isSubmitting || authIsPreparing}
                fullWidth
                onPress={() => {
                  setSent(false)
                  setCooldownSeconds(0)
                  setFeedback(null)
                }}
              />
            </>
          )}

          <Button
            label="Cancel"
            variant="ghost"
            disabled={isSubmitting || authIsPreparing}
            fullWidth
            onPress={() => {
              router.back()
            }}
          />
          {feedback ? <SettingsFeedback message={feedback} tone="error" /> : null}
        </View>
      </SettingsPanel>
    </View>
  )
}

function AccountAccessHeading({
  title,
  explanation,
}: {
  title: string
  explanation: string
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        accessibilityRole="header"
        selectable
        style={[typography.hero, { color: colors.onSurface, fontStyle: 'italic' }]}
      >
        {title}
      </Text>
      <Text
        selectable
        style={[typography.body, { color: colors.textMuted }]}
      >
        {explanation}
      </Text>
    </View>
  )
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The account action could not be completed safely. Please retry.'
}
