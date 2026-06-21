import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { colors, spacing, typography } from '@/theme'
import { Card } from '@/ui/card'
import { Text, View } from 'react-native'

const benefits = [
  'More AI recipe cards',
  'More grocery lists',
  'More collections',
  'Future export options',
]

export default function PaywallRoute() {
  return (
    <PlaceholderScreen
      screenName="paywall"
      eyebrow="Pro"
      title="Recipe Dost Pro"
      description="The paywall shell is present, but RevenueCat is not initialized for development."
      primaryAction={{ label: 'Back home', href: '/home' }}
      secondaryAction={{ label: 'Settings', href: '/settings' }}
    >
      <Card>
        <View style={{ gap: spacing.sm }}>
          {benefits.map((benefit) => (
            <Text
              selectable
              key={benefit}
              style={[typography.body, { color: colors.text }]}
            >
              {benefit}
            </Text>
          ))}
        </View>
      </Card>
    </PlaceholderScreen>
  )
}
