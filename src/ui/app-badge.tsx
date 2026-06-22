import { colors, radius, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type BadgeTone = 'default' | 'primary' | 'accent' | 'warning'

type Props = {
  label: string
  tone?: BadgeTone
}

const toneStyles: Record<
  BadgeTone,
  { backgroundColor: string; color: string }
> = {
  default: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
  },
  primary: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
  },
  accent: {
    backgroundColor: colors.accentSoft,
    color: colors.accent,
  },
  warning: {
    backgroundColor: colors.warningSurface,
    color: colors.warning,
  },
}

export function AppBadge({ label, tone = 'default' }: Props) {
  const toneStyle = toneStyles[tone]

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
        backgroundColor: toneStyle.backgroundColor,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text selectable style={[typography.caption, { color: toneStyle.color }]}>
        {label}
      </Text>
    </View>
  )
}

