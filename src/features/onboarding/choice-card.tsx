import { colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text } from 'react-native'

type Props<TValue extends string> = {
  label: string
  value: TValue
  selected: boolean
  onPress: (value: TValue) => void
}

export function ChoiceCard<TValue extends string>({
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
        minHeight: 52,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: selected ? '#EAF5EF' : colors.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Text
        selectable
        style={[
          typography.body,
          {
            color: selected ? colors.primary : colors.text,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}
