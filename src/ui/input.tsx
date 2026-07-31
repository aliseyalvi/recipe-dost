import { colors, radius, spacing, typography } from '@/theme'
import { Text, TextInput, TextInputProps, View } from 'react-native'

type Props = TextInputProps & {
  label: string
}

export function Input({ label, ...textInputProps }: Props) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...textInputProps}
        style={[
          typography.body,
          {
            minHeight: 52,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.surfaceMuted,
            color: colors.text,
            paddingHorizontal: spacing.lg,
          },
          textInputProps.style,
        ]}
      />
    </View>
  )
}
