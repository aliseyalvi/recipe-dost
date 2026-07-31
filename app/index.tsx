import { getAppEntryDecision } from '@/features/onboarding/welcome-flow-model'
import { useOnboardingHydration } from '@/features/onboarding/use-onboarding-hydration'
import { useAuth } from '@/providers/auth-provider'
import { ErrorState } from '@/ui/error-state'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { Redirect } from 'expo-router'

export default function IndexRoute() {
  const auth = useAuth()
  const onboardingHydration = useOnboardingHydration()
  const decision = getAppEntryDecision({
    authStatus: auth.authReadiness,
    onboardingState: onboardingHydration.onboardingState,
  })

  if (decision.status === 'loading') {
    return (
      <AppLoadingScreen
        message="Preparing your kitchen..."
        detail="Gathering your Recipe Dost setup"
      />
    )
  }

  if (decision.status === 'error') {
    return (
      <ErrorState
        title={decision.source === 'auth' ? 'Could not start Recipe Dost' : 'Could not read setup'}
        message={
          decision.source === 'auth'
            ? auth.error?.message ?? 'Recipe Dost could not establish a safe session.'
            : 'Recipe Dost could not safely read onboarding settings. Nothing was marked complete.'
        }
        retryLabel="Retry"
        onRetry={() => {
          void (decision.source === 'auth'
            ? auth.retry()
            : onboardingHydration.retry())
        }}
      />
    )
  }

  return <Redirect href={decision.href} />
}
