import { useAuth } from '@/providers/auth-provider'
import { useOnboardingHydration } from '@/features/onboarding/use-onboarding-hydration'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { ErrorState } from '@/ui/error-state'
import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'

export function AuthCallbackScreen() {
  const router = useRouter()
  const { authCallbackState, authCallbackError } = useAuth()
  const onboarding = useOnboardingHydration()

  useEffect(() => {
    if (authCallbackState === 'success') {
      router.replace('/home')
    }
  }, [authCallbackState, router])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {authCallbackState === 'error' ? (
        <ErrorState
          title="Could not open this sign-in link"
          message={
            authCallbackError ??
            'The link may be invalid or expired. Request a new link.'
          }
          retryLabel={
            onboarding.onboardingState === 'completed'
              ? 'Back to Settings'
              : 'Back to welcome'
          }
          onRetry={() => {
            if (onboarding.onboardingState === 'completed') {
              router.replace('/settings')
            } else {
              router.replace({ pathname: '/welcome', params: { step: 'final' } })
            }
          }}
        />
      ) : (
        <AppLoadingScreen
          message="Opening Recipe Dost…"
          detail="Recovering your account and Premium access"
        />
      )}
    </>
  )
}
