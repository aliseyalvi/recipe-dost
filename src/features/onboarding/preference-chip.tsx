import { colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text } from 'react-native'

type Props<TValue extends string> = {
  label: string
  value: TValue
  selected: boolean
  onPress: (value: TValue) => void
}

export function PreferenceChip<TValue extends string>({
  label,
  value,
  selected,
  onPress,
}: Props<TValue>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        borderRadius: radius.pill,
        backgroundColor: selected ? '#EAF5EF' : colors.surface,
        paddingHorizontal: spacing.lg,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Text
        selectable
        style={[
          typography.caption,
          {
            color: selected ? colors.primary : colors.text,
            fontWeight: '700',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}
