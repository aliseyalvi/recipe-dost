import { getUserProfile } from '@/features/onboarding/profile-api'
import { useAuth } from '@/providers/auth-provider'
import { useQuery } from '@tanstack/react-query'

export function useUserProfileQuery() {
  const { user } = useAuth()

  return useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['user-profile', user?.id],
    queryFn: () => getUserProfile(user?.id ?? ''),
  })
}
