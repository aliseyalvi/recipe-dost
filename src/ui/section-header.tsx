import { colors, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type Props = {
  title: string
  subtitle?: string
}

export function SectionHeader({ title, subtitle }: Props) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={[typography.heading, { color: colors.text }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

