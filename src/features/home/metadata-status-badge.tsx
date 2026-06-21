import { colors, radius, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type Props = {
  status: string | null
}

export function MetadataStatusBadge({ status }: Props) {
  const label = status ? status.replaceAll('_', ' ') : 'not checked'

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text
        selectable
        style={[
          typography.caption,
          {
            color: colors.textMuted,
            textTransform: 'capitalize',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}
