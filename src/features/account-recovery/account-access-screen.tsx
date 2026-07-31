import { SettingsFeedback, SettingsPanel } from '@/features/settings/settings-presentation'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { AppIcon } from '@/ui/app-icon'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import type { ComponentProps } from 'react'
import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type SecureStep = 'email' | 'verification' | 'password'

export function AccountAccessScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>()
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode
  const mode = rawMode === 'secure' ? 'secure' : 'recover'

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
            {mode === 'secure' ? (
              <SecureAccountFlow />
            ) : (
              <RecoverAccountFlow />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}

function SecureAccountFlow() {
  const router = useRouter()
  const {
    requestAccountLink,
    resendAccountLinkCode,
    verifyAccountLinkCode,
    completeAccountLinkPassword,
  } = useAuth()
  const { trackEvent } = usePostHog()
  const [step, setStep] = useState<SecureStep>('email')
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    trackEvent('account_recovery_form_opened', { mode: 'link' })
  }, [trackEvent])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1_000)
    return () => {
      clearInterval(timer)
    }
  }, [cooldownSeconds])

  const submitEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setFeedback('Enter a valid email address.')
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      await requestAccountLink(normalizedEmail)
      setEmail(normalizedEmail)
      setVerificationCode('')
      setCooldownSeconds(60)
      setStep('verification')
      setFeedback('Enter the six-digit code sent to your email.')
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(verificationCode)) {
      setFeedback('Enter the six-digit verification code.')
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      await verifyAccountLinkCode({
        email,
        token: verificationCode,
      })
      setStep('password')
      setFeedback('Email verified. Create a password to finish securing your account.')
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendCode = async () => {
    if (isSubmitting || cooldownSeconds > 0) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      await resendAccountLinkCode(email)
      setCooldownSeconds(60)
      setFeedback('A new verification code was sent.')
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitPassword = async () => {
    if (password.length < 8) {
      setFeedback('Use a password with at least 8 characters.')
      return
    }
    if (password !== confirmation) {
      setFeedback('The passwords do not match.')
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      await completeAccountLinkPassword(password)
      setPassword('')
      setConfirmation('')
      router.replace('/settings')
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <AccountAccessHeading
        title="Secure your account"
        explanation="Add recovery details while preserving this same Recipe Dost account, recipes, and Premium access."
      />
      <SettingsPanel>
        <View style={{ gap: spacing.lg, paddingVertical: spacing.lg }}>
          {step === 'email' ? (
            <>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                editable={!isSubmitting}
                returnKeyType="next"
                onSubmitEditing={() => {
                  void submitEmail()
                }}
              />
              <Button
                label={isSubmitting ? 'Sending code…' : 'Continue'}
                disabled={isSubmitting}
                fullWidth
                onPress={() => {
                  void submitEmail()
                }}
              />
            </>
          ) : null}

          {step === 'verification' ? (
            <>
              <Text selectable style={[typography.body, { color: colors.textMuted }]}>
                Verifying {email}
              </Text>
              <Input
                label="Verification code"
                value={verificationCode}
                onChangeText={(value) => {
                  setVerificationCode(value.replace(/\D/g, '').slice(0, 6))
                }}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                keyboardType="number-pad"
                maxLength={6}
                editable={!isSubmitting}
              />
              <Button
                label={isSubmitting ? 'Verifying…' : 'Verify code'}
                disabled={isSubmitting || verificationCode.length !== 6}
                fullWidth
                onPress={() => {
                  void verifyCode()
                }}
              />
              <Button
                label={
                  cooldownSeconds > 0
                    ? `Send new code in ${cooldownSeconds}s`
                    : 'Send new code'
                }
                variant="ghost"
                disabled={isSubmitting || cooldownSeconds > 0}
                fullWidth
                onPress={() => {
                  void resendCode()
                }}
              />
              <Button
                label="Change email"
                variant="ghost"
                disabled={isSubmitting}
                fullWidth
                onPress={() => {
                  setVerificationCode('')
                  setCooldownSeconds(0)
                  setFeedback(null)
                  setStep('email')
                }}
              />
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <PasswordInput
                label="New password"
                value={password}
                onChangeText={setPassword}
                visible={showPassword}
                onToggleVisibility={() => {
                  setShowPassword((visible) => !visible)
                }}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!isSubmitting}
                testID="secure-password-visibility"
              />
              <PasswordInput
                label="Confirm password"
                value={confirmation}
                onChangeText={setConfirmation}
                visible={showConfirmation}
                onToggleVisibility={() => {
                  setShowConfirmation((visible) => !visible)
                }}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!isSubmitting}
                testID="secure-confirmation-visibility"
              />
              <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
                Use at least 8 characters.
              </Text>
              <Button
                label={isSubmitting ? 'Securing account…' : 'Secure account'}
                disabled={
                  isSubmitting ||
                  password.length < 8 ||
                  password !== confirmation
                }
                fullWidth
                onPress={() => {
                  void submitPassword()
                }}
              />
            </>
          ) : null}

          {feedback ? <SettingsFeedback message={feedback} /> : null}
        </View>
      </SettingsPanel>
    </View>
  )
}

function RecoverAccountFlow() {
  const router = useRouter()
  const { signInToRecover } = useAuth()
  const { trackEvent } = usePostHog()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    trackEvent('account_recovery_form_opened', { mode: 'sign_in' })
  }, [trackEvent])

  const submitRecovery = async (confirmGuestSwitch = false) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!isValidEmail(normalizedEmail)) {
      setFeedback('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setFeedback('Enter the password used to secure this account.')
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const result = await signInToRecover({
        email: normalizedEmail,
        password,
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
                void submitRecovery(true)
              },
            },
          ]
        )
        return
      }

      setPassword('')
      router.replace('/settings')
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <AccountAccessHeading
        title="Recover your account"
        explanation="Sign in with the email and password used to secure Recipe Dost."
      />
      <SettingsPanel>
        <View style={{ gap: spacing.lg, paddingVertical: spacing.lg }}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            editable={!isSubmitting}
          />
          <PasswordInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            visible={showPassword}
            onToggleVisibility={() => {
              setShowPassword((visible) => !visible)
            }}
            autoComplete="current-password"
            textContentType="password"
            editable={!isSubmitting}
            testID="recover-password-visibility"
          />
          <Button
            label={isSubmitting ? 'Signing in…' : 'Sign in'}
            disabled={isSubmitting}
            fullWidth
            onPress={() => {
              void submitRecovery()
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
      <Text selectable style={[typography.body, { color: colors.textMuted }]}>
        {explanation}
      </Text>
    </View>
  )
}

function PasswordInput({
  visible,
  onToggleVisibility,
  testID,
  ...props
}: ComponentProps<typeof Input> & {
  visible: boolean
  onToggleVisibility: () => void
  testID: string
}) {
  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      rightAccessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={12}
          onPress={onToggleVisibility}
          testID={testID}
          style={{ padding: spacing.sm }}
        >
          <AppIcon
            name={visible ? 'eye-off' : 'eye'}
            color={colors.textMuted}
          />
        </Pressable>
      }
    />
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
