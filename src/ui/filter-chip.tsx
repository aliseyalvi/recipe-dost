import { colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text } from 'react-native'

type Props = {
  label: string
  selected: boolean
  onPress: () => void
}

export function FilterChip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 38,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Text
        selectable={false}
        style={[
          typography.caption,
          {
            color: selected ? colors.primary : colors.textMuted,
            fontWeight: selected ? '800' : '700',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

