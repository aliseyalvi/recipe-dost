import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Redirect } from 'expo-router'

export default function IndexRoute() {
  const profileQuery = useUserProfileQuery()

  if (profileQuery.isLoading || profileQuery.isFetching) {
    return <LoadingState message="Checking setup..." />
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
      href={profileQuery.data?.onboarding_completed ? '/home' : '/welcome'}
    />
  )
}
