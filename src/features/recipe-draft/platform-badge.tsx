import { getPlatformLabel } from '@/features/recipe-draft/platform'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { colors, radius, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type Props = {
  platform: RecipePlatform
}

export function PlatformBadge({ platform }: Props) {
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
      <Text selectable style={[typography.caption, { color: colors.primary }]}>
        {getPlatformLabel(platform)}
      </Text>
    </View>
  )
}
