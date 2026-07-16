import { WelcomeExperience } from '@/features/onboarding/welcome-experience'
import {
  WELCOME_COMPLETION_HREF,
} from '@/features/onboarding/welcome-flow-model'
import { saveOnboardingProfile } from '@/features/onboarding/profile-api'
import { useOnboardingStore } from '@/features/onboarding/onboarding-store'
import { useOnboardingHydration } from '@/features/onboarding/use-onboarding-hydration'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { useAuth } from '@/providers/auth-provider'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { ErrorState } from '@/ui/error-state'
import { Screen } from '@/ui/screen'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function WelcomeRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { track } = usePostHog()
  const { profile, setProfile } = useOnboardingStore()
  const hasHydratedOnboarding = useOnboardingHydration()
  const profileQuery = useUserProfileQuery()
  const didTrackStart = useRef(false)
  const completionInFlight = useRef(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [completionError, setCompletionError] = useState<Error | null>(null)

  const completeOnboarding = useCallback(async () => {
    if (completionInFlight.current) {
      return
    }

    if (!user?.id) {
      setCompletionError(new Error('Your app session is not ready yet.'))
      return
    }

    completionInFlight.current = true
    setIsCompleting(true)
    setCompletionError(null)

    try {
      await saveOnboardingProfile({
        userId: user.id,
        profile: {
          ...profile,
          onboardingCompleted: true,
        },
        onboardingCompleted: true,
      })
      setProfile({ onboardingCompleted: true })
      track('onboarding_completed')
      await queryClient.invalidateQueries({
        queryKey: ['user-profile', user.id],
      })
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
  }, [profile, queryClient, router, setProfile, track, user?.id])

  useEffect(() => {
    if (
      didTrackStart.current ||
      !hasHydratedOnboarding ||
      profileQuery.isLoading ||
      profileQuery.error ||
      (profileQuery.data?.onboarding_completed &&
        profile.onboardingCompleted)
    ) {
      return
    }

    didTrackStart.current = true
    track('onboarding_started')
  }, [
    profileQuery.data?.onboarding_completed,
    profileQuery.error,
    profileQuery.isLoading,
    hasHydratedOnboarding,
    profile.onboardingCompleted,
    track,
  ])

  if (profileQuery.isLoading || !hasHydratedOnboarding) {
    return (
      <AppLoadingScreen
        message="Preparing your welcome..."
        detail="A calmer kitchen starts here"
      />
    )
  }

  if (profileQuery.error) {
    return (
      <ErrorState
        title="Could not check setup"
        message={profileQuery.error.message}
        retryLabel="Retry"
        onRetry={() => {
          void profileQuery.refetch()
        }}
      />
    )
  }

  if (
    profileQuery.data?.onboarding_completed &&
    profile.onboardingCompleted
  ) {
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
            void completeOnboarding()
          }}
        />
      </Screen>
    )
  }

  return (
    <WelcomeExperience
      onFinish={() => {
        void completeOnboarding()
      }}
      onSkip={() => {
        void completeOnboarding()
      }}
    />
  )
}
