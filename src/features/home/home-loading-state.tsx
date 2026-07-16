import { colors, radius, spacing, typography } from '@/theme'
import { SkeletonBar } from '@/features/home/editorial-layout'
import { Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

export function HomeLoadingState() {
  return (
    <Animated.View
      accessibilityLabel="Loading your recipes"
      accessibilityRole="progressbar"
      entering={FadeIn.duration(200)}
      style={{ gap: spacing.sectionGap }}
    >
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text
          selectable
          style={[typography.body, { color: colors.onSurface, fontWeight: '700' }]}
        >
          Gathering your recipes...
        </Text>
        <Text
          selectable
          style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}
        >
          Your kitchen will be ready in a moment.
        </Text>
      </View>

      <HomeSectionSkeleton titleWidth="28%" />
      <HomeSectionSkeleton titleWidth="38%" compact />
    </Animated.View>
  )
}

function HomeSectionSkeleton({
  titleWidth,
  compact = false,
}: {
  titleWidth: `${number}%`
  compact?: boolean
}) {
  return (
    <View style={{ gap: spacing.lg }}>
      <SkeletonBar width={titleWidth} />
      <View
        style={{
          minHeight: compact ? 170 : 230,
          overflow: 'hidden',
          borderRadius: radius.card,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLow,
          padding: spacing.cardPadding,
        }}
      >
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: colors.surfaceContainer,
            opacity: 0.52,
          }}
        />
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            gap: spacing.md,
          }}
        >
          <SkeletonBar width="68%" />
          <SkeletonBar width="44%" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SkeletonPill width={72} />
            <SkeletonPill width={92} />
          </View>
        </View>
      </View>
      {!compact ? (
        <View
          style={{
            height: 46,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.primaryOutlineSoft,
            backgroundColor: colors.primaryWash,
          }}
        />
      ) : null}
    </View>
  )
}

function SkeletonPill({ width }: { width: number }) {
  return (
    <View
      style={{
        width,
        height: 26,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceContainerHighest,
        opacity: 0.72,
      }}
    />
  )
}
