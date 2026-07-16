import { getAppEntryHref } from '@/features/onboarding/welcome-flow-model'
import { useOnboardingStore } from '@/features/onboarding/onboarding-store'
import { useOnboardingHydration } from '@/features/onboarding/use-onboarding-hydration'
import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { ErrorState } from '@/ui/error-state'
import { AppLoadingScreen } from '@/ui/app-loading-screen'
import { Redirect } from 'expo-router'

export default function IndexRoute() {
  const profileQuery = useUserProfileQuery()
  const localOnboardingCompleted = useOnboardingStore(
    (state) => state.profile.onboardingCompleted
  )
  const hasHydratedOnboarding = useOnboardingHydration()

  if (
    profileQuery.isLoading ||
    profileQuery.isFetching ||
    !hasHydratedOnboarding
  ) {
    return (
      <AppLoadingScreen
        message="Preparing your kitchen..."
        detail="Gathering your Recipe Dost setup"
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

  return (
    <Redirect
      href={getAppEntryHref(
        profileQuery.data?.onboarding_completed,
        localOnboardingCompleted
      )}
    />
  )
}
