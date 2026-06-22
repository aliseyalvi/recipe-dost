import { colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text, ViewStyle } from 'react-native'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent'

type Props = {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  disabled?: boolean
  fullWidth?: boolean
  testID?: string
}

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  accent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  testID,
}: Props) {
  const isFilled = variant === 'primary' || variant === 'accent'
  const textColor =
    variant === 'accent'
      ? '#21150B'
      : isFilled
        ? colors.primaryText
        : colors.primary

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        variantStyles[variant],
      ]}
    >
      <Text
        selectable={false}
        style={[
          typography.body,
          {
            color: textColor,
            fontWeight: '700',
            textAlign: 'center',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}
