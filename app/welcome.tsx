import { useUserProfileQuery } from '@/features/onboarding/use-user-profile-query'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ErrorState } from '@/ui/error-state'
import { LoadingState } from '@/ui/loading-state'
import { Screen } from '@/ui/screen'
import { Redirect, useRouter } from 'expo-router'
import { Text, View } from 'react-native'

export default function WelcomeRoute() {
  const router = useRouter()
  const { track } = usePostHog()
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

  if (profileQuery.data?.onboarding_completed) {
    return <Redirect href="/home" />
  }

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.caption, { color: colors.accent }]}>
          Recipe Dost
        </Text>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Save recipe videos as clean recipe cards
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Turn Reels, TikToks, Shorts, and food videos into ingredients,
          steps, grocery lists, and Urdu/Roman Urdu cooking notes.
        </Text>
      </View>

      <Card>
        <Text selectable style={[typography.body, { color: colors.text }]}>
          We save recipe cards and links, not video files.
        </Text>
      </Card>

      <Button
        label="Start Free"
        fullWidth
        onPress={() => {
          track('onboarding_started')
          router.push('/onboarding')
        }}
      />
    </Screen>
  )
}
