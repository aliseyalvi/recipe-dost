import { colors, spacing, typography } from '@/theme'
import { Card } from '@/ui/card'
import { Text, View } from 'react-native'

export type UsageLimitRow = {
  label: string
  used: number
  limit: number
}

type Props = {
  title?: string
  subtitle?: string
  rows: UsageLimitRow[]
}

export function UsageLimitCard({
  title = 'Free plan',
  subtitle = 'Basic organizing is free. AI features use free tries.',
  rows,
}: Props) {
  return (
    <Card>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>
          {title}
        </Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <Text
              selectable
              style={[typography.body, { flex: 1, color: colors.text }]}
            >
              {row.label}
            </Text>
            <Text selectable style={[typography.body, { color: colors.textMuted }]}>
              {row.used} / {row.limit}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  )
}

export function UsagePill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {label}: {value}
      </Text>
    </View>
  )
}
