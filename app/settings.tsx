import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { colors, spacing, typography } from '@/theme'
import { Card } from '@/ui/card'
import { Text, View } from 'react-native'

export default function SettingsRoute() {
  return (
    <PlaceholderScreen
      screenName="settings"
      eyebrow="Account"
      title="Settings"
      description="Language, subscription, support, privacy, terms, and account deletion will live here."
      primaryAction={{ label: 'View Pro', href: '/paywall' }}
      secondaryAction={{ label: 'Back home', href: '/home' }}
    >
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            Telemetry: disabled in development
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            RevenueCat: not initialized
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            Supabase: not connected in M1
          </Text>
        </View>
      </Card>
    </PlaceholderScreen>
  )
}
