import { colors, typography } from '@/theme'
import { Text, TextStyle } from 'react-native'

export function UrduText({
  children,
  muted = false,
  style,
}: {
  children: string
  muted?: boolean
  style?: TextStyle
}) {
  return (
    <Text
      selectable
      style={[
        typography.body,
        {
          color: muted ? colors.textMuted : colors.text,
          lineHeight: 28,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}
