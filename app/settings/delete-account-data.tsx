import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { NestedScreenHeader } from '@/ui/screen-header'
import { useEffect } from 'react'
import { Alert, Text, View } from 'react-native'

const deletedDataPoints = [
  'saved recipe links',
  'AI recipe cards',
  'grocery lists',
  'app profile and preferences',
] as const

export default function DeleteAccountDataSettingsRoute() {
  const { track } = usePostHog()

  useEffect(() => {
    track('settings_delete_account_data_viewed')
  }, [track])

  const handleRequestDeletion = () => {
    track('delete_account_data_request_placeholder_tapped')
    Alert.alert(
      'Deletion request',
      'Automated account deletion is not live yet. Contact support to request deletion before the backend flow is added.'
    )
  }

  return (
    <Screen compact>
      <NestedScreenHeader title="Delete account & data" fallbackRoute="/settings" />

      <Card tone="muted">
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          Deletion scaffold
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Deleting your account will remove your Recipe Dost app data for this
          profile.
        </Text>

        <View style={{ gap: spacing.sm }}>
          {deletedDataPoints.map((point) => (
            <View
              key={point}
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                alignItems: 'flex-start',
              }}
            >
              <Text
                selectable={false}
                style={[typography.body, { color: colors.danger }]}
              >
                {'-'}
              </Text>
              <Text
                selectable
                style={[typography.body, { flex: 1, color: colors.text }]}
              >
                {point}
              </Text>
            </View>
          ))}
        </View>

        <Text selectable style={[typography.body, { color: colors.danger }]}>
          This action cannot be undone.
        </Text>
      </Card>

      <Card tone="warm">
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Automated deletion is not connected in this build. The backend deletion
          function will be added before store submission once the final data map
          is verified.
        </Text>
        <Button
          label="Request deletion"
          variant="secondary"
          onPress={handleRequestDeletion}
        />
      </Card>
    </Screen>
  )
}
