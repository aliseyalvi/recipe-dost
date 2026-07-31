import { WelcomeExperience } from '@/features/onboarding/welcome-experience'
import {
  getOnboardingCompletionEvent,
  WELCOME_COMPLETION_HREF,
  welcomeSlides,
} from '@/features/onboarding/welcome-flow-model'
import { markOnboardingCompleted } from '@/features/onboarding/onboarding-store'
import { useOnboardingHydration } from '@/features/onboarding/use-onboarding-hydration'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { ErrorState } from '@/ui/error-state'
import { Screen } from '@/ui/screen'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function WelcomeRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{ step?: string | string[] }>()
  const rawStep = Array.isArray(params.step) ? params.step[0] : params.step
  const { authReadiness } = useAuth()
  const { track } = usePostHog()
  const onboardingHydration = useOnboardingHydration()
  const didTrackStart = useRef(false)
  const completionInFlight = useRef(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [completionError, setCompletionError] = useState<Error | null>(null)

  const completeOnboarding = useCallback(async (outcome: 'completed' | 'skipped') => {
    if (completionInFlight.current) {
      return
    }

    completionInFlight.current = true
    setIsCompleting(true)
    setCompletionError(null)

    try {
      await markOnboardingCompleted()
      track(getOnboardingCompletionEvent(outcome))
      router.replace(WELCOME_COMPLETION_HREF)
    } catch (caughtError) {
      setCompletionError(
        caughtError instanceof Error
          ? caughtError
          : new Error('Could not finish your welcome setup.')
      )
    } finally {
      completionInFlight.current = false
      setIsCompleting(false)
    }
  }, [router, track])

  useEffect(() => {
    if (
      didTrackStart.current ||
      onboardingHydration.hydrationStatus !== 'ready' ||
      onboardingHydration.onboardingState === 'completed'
    ) {
      return
    }

    didTrackStart.current = true
    track('onboarding_started')
  }, [
    onboardingHydration.hydrationStatus,
    onboardingHydration.onboardingState,
    track,
  ])

  if (onboardingHydration.onboardingState === 'loading') {
    return (
      <AppLoadingScreen
        message="Preparing your welcome..."
        detail="A calmer kitchen starts here"
      />
    )
  }

  if (onboardingHydration.onboardingState === 'error') {
    return (
      <ErrorState
        title="Could not read setup"
        message="Recipe Dost could not safely read onboarding settings. Nothing was marked complete."
        retryLabel="Retry"
        onRetry={() => {
          void onboardingHydration.retry()
        }}
      />
    )
  }

  if (onboardingHydration.onboardingState === 'completed') {
    return <Redirect href={WELCOME_COMPLETION_HREF} />
  }

  if (isCompleting) {
    return (
      <AppLoadingScreen
        message="Opening your kitchen..."
        detail="Saving your Recipe Dost welcome"
      />
    )
  }

  if (completionError) {
    return (
      <Screen>
        <ErrorState
          title="Could not finish setup"
          message={completionError.message}
          retryLabel="Try Again"
          onRetry={() => {
            void completeOnboarding('completed')
          }}
        />
      </Screen>
    )
  }

  return (
    <WelcomeExperience
      initialStep={
        rawStep === 'final' ? welcomeSlides.length - 1 : 0
      }
      onFinish={() => {
        void completeOnboarding('completed')
      }}
      onRecover={() => {
        router.push({
          pathname: '/account-access',
          params: { mode: 'recover', source: 'onboarding' },
        })
      }}
      recoverDisabled={
        authReadiness === 'initializing' || authReadiness === 'recovering'
      }
      onSkip={() => {
        void completeOnboarding('skipped')
      }}
    />
  )
}
