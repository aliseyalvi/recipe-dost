import { colors, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
}

export function AppHeader({ eyebrow, title, subtitle }: Props) {
  return (
    <View style={{ gap: spacing.sm }}>
      {eyebrow ? (
        <Text
          selectable
          style={[
            typography.caption,
            {
              color: colors.accent,
              fontWeight: '800',
              textTransform: 'uppercase',
            },
          ]}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text selectable style={[typography.title, { color: colors.text }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

