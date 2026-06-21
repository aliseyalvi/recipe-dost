import { useRecipeDraftStore } from '@/features/recipe-draft/recipe-draft-store'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Screen } from '@/ui/screen'
import { colors, spacing, typography } from '@/theme'
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'

export default function RecipeReadyRoute() {
  const router = useRouter()
  const { draft } = useRecipeDraftStore()

  return (
    <Screen>
      <View style={{ gap: spacing.md }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>
          Recipe card generation is coming next
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          Your link and notes are ready. The next milestone will connect backend
          saving and AI recipe cards.
        </Text>
      </View>

      {draft ? (
        <Card>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            Draft saved locally for the next step.
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            No database insert, metadata fetch, or AI generation happened in M5.
          </Text>
        </Card>
      ) : null}

      <Button
        label="Back Home"
        fullWidth
        onPress={() => router.replace('/home')}
      />
    </Screen>
  )
}
