import { PlaceholderScreen } from '@/screens/placeholder-screen'
import { colors, spacing, typography } from '@/theme'
import { Card } from '@/ui/card'
import { Text, View } from 'react-native'

const preferences = [
  'Pakistani and mixed cooking',
  'English, Urdu, or Roman Urdu',
  'Household size',
  'Cooking confidence',
]

export default function OnboardingRoute() {
  return (
    <PlaceholderScreen
      screenName="onboarding"
      eyebrow="Personalize"
      title="Choose the basics for better recipe cards"
      description="These placeholder questions reflect the PRD, without saving data yet."
      primaryAction={{ label: 'Continue to home', href: '/home' }}
      secondaryAction={{ label: 'Back to welcome', href: '/welcome' }}
    >
      <Card>
        <View style={{ gap: spacing.sm }}>
          {preferences.map((preference) => (
            <Text
              selectable
              key={preference}
              style={[typography.body, { color: colors.text }]}
            >
              {preference}
            </Text>
          ))}
        </View>
      </Card>
    </PlaceholderScreen>
  )
}
