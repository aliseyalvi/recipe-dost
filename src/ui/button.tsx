import { colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text, ViewStyle } from 'react-native'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

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
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
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
  const isPrimary = variant === 'primary'

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
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        variantStyles[variant],
      ]}
    >
      <Text
        selectable
        style={[
          typography.body,
          {
            color: isPrimary ? colors.primaryText : colors.primary,
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
