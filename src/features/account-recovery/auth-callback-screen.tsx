import { useAuth } from '@/providers/auth-provider'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { ErrorState } from '@/ui/error-state'
import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'

export function AuthCallbackScreen() {
  const router = useRouter()
  const { authCallbackState, authCallbackError } = useAuth()

  useEffect(() => {
    if (authCallbackState === 'success') {
      router.replace('/settings')
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
          retryLabel="Back to Settings"
          onRetry={() => {
            router.replace('/settings')
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
