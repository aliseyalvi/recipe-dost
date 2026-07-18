import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { NestedScreenHeader } from '@/ui/screen-header'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { LegalLinks } from '@/features/legal/legal-links'

const privacyPoints = [
  'We save recipe links and AI recipe cards so your library works across app sessions.',
  'Recipe Dost does not save raw videos permanently.',
  'Video processing is temporary when AI generation needs it.',
  'AI processing may send video or text content to AI providers for recipe generation.',
  'We use Supabase for account, app, recipe, and preference data.',
  'We use RevenueCat for subscription purchase status and subscription management metadata.',
  'We use PostHog for privacy-filtered app interactions and Sentry for sanitized technical crash diagnostics.',
  'AI-content reports store a category, an optional short note, app/build metadata, and the related recipe-card identifier.',
  'Recipe text, source links, report notes, and AI output are not sent to PostHog or Sentry.',
  'You can request deletion of your account and app data.',
] as const

export default function PrivacyDataSettingsRoute() {
  const { track } = usePostHog()

  useEffect(() => {
    track('settings_privacy_data_viewed')
  }, [track])

  return (
    <Screen compact>
      <NestedScreenHeader title="Privacy & data usage" fallbackRoute="/settings" />

      <Card>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          How Recipe Dost uses data
        </Text>
        <View style={{ gap: spacing.md }}>
          {privacyPoints.map((point) => (
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
                style={[typography.body, { color: colors.accent }]}
              >
                {'-'}
              </Text>
              <Text
                selectable
                style={[typography.body, { flex: 1, color: colors.textMuted }]}
              >
                {point}
              </Text>
            </View>
          ))}
        </View>
      </Card>
      <Card tone="muted">
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>Open the verified public legal and support resources:</Text>
        <LegalLinks types={['privacy_policy', 'terms', 'account_deletion', 'support']} />
      </Card>
    </Screen>
  )
}
