import { colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text, View } from 'react-native'

type Props = {
  title: string
  description: string
  eyebrow?: string
  onPress: () => void
}

export function QuickActionCard({ title, description, eyebrow, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 76,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceMuted,
        padding: spacing.md,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View style={{ gap: spacing.xs }}>
        {eyebrow ? (
          <Text selectable style={[typography.caption, { color: colors.accent }]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text selectable style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
          {title}
        </Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
    </Pressable>
  )
}
