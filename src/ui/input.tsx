import { colors, radius, spacing, typography } from '@/theme'
import type { ReactNode } from 'react'
import { Text, TextInput, TextInputProps, View } from 'react-native'

type Props = TextInputProps & {
  label: string
  rightAccessory?: ReactNode
}

export function Input({ label, rightAccessory, ...textInputProps }: Props) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View style={{ position: 'relative' }}>
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
              paddingLeft: spacing.lg,
              paddingRight: rightAccessory ? 56 : spacing.lg,
            },
            textInputProps.style,
          ]}
        />
        {rightAccessory ? (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: spacing.sm,
              top: 0,
              justifyContent: 'center',
            }}
          >
            {rightAccessory}
          </View>
        ) : null}
      </View>
    </View>
  )
}
