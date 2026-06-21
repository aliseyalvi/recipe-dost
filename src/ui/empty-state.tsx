import { Button } from '@/ui/button'
import { colors, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type Props = {
  title: string
  message: string
  actionLabel?: string
  onActionPress?: () => void
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onActionPress,
}: Props) {
  return (
    <View
      style={{
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceMuted,
        padding: spacing.xl,
      }}
    >
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        {title}
      </Text>
      <Text selectable style={[typography.body, { color: colors.textMuted }]}>
        {message}
      </Text>
      {actionLabel ? (
        <Button label={actionLabel} onPress={onActionPress} variant="secondary" />
      ) : null}
    </View>
  )
}
