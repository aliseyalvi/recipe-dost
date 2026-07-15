import { OutlinePillButton, SkeletonBar } from '@/features/home/editorial-layout'
import { borders, colors, radius, spacing, typography } from '@/theme'
import { Pressable, Text, View } from 'react-native'
import { AppIcon } from '@/ui/app-icon'

export function ProcessingCard({
  stageLabel,
  progress,
  onPress,
  onOpenLibrary,
}: {
  stageLabel: string
  progress?: number | null
  onPress: () => void
  onOpenLibrary: () => void
}) {
  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${stageLabel}. Open recipe details`}
        onPress={onPress}
        style={({ pressed }) => ({
          gap: spacing.lg,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          ...borders.subtle,
          backgroundColor: colors.surfaceContainer,
          padding: spacing.lg,
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 100,
              height: 100,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.surfaceContainerHighest,
            }}
          >
            <AppIcon name="hourglass" color={colors.onSurfaceVariant} size={32} />
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <View
            style={{
              alignSelf: 'flex-start',
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceContainerHighest,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <AppIcon name="usage" color={colors.primary} size={14} />
              <Text selectable={false} style={[typography.caption, { color: colors.primary }]}>
                {stageLabel}
              </Text>
            </View>
          </View>
          <SkeletonBar width="92%" />
          <SkeletonBar width="66%" />
          {typeof progress === 'number' ? (
            <Text
              selectable
              style={[
                typography.caption,
                { color: colors.onSurfaceVariant, fontVariant: ['tabular-nums'] },
              ]}
            >
              {progress}% complete
            </Text>
          ) : null}
        </View>
      </Pressable>
      <OutlinePillButton label="Open Library" onPress={onOpenLibrary} />
    </View>
  )
}
