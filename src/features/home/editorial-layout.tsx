import { borders, colors, radius, spacing, typography } from '@/theme'
import Constants from 'expo-constants'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppIcon } from '@/ui/app-icon'

export function EditorialScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const topInset = insets.top || Constants.statusBarHeight || 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: spacing.sectionGap,
          paddingHorizontal: spacing.mobileMargin,
          paddingTop: topInset + spacing.lg,
          paddingBottom: 136 + insets.bottom,
        }}
      >
        {children}
      </ScrollView>
    </View>
  )
}

export function EditorialHeader({
  usageLabel,
  isUsageLoading,
  isUsageRefreshing,
  hasUsageWarning,
  onUsagePress,
}: {
  usageLabel: string | null
  isUsageLoading: boolean
  isUsageRefreshing: boolean
  hasUsageWarning: boolean
  onUsagePress: () => void
}) {
  return (
    <View
      style={{
        minHeight: 72,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingHorizontal: 76,
      }}
    >
      <UsagePill
        label={usageLabel}
        isLoading={isUsageLoading}
        isRefreshing={isUsageRefreshing}
        hasWarning={hasUsageWarning}
        onPress={onUsagePress}
      />
      <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
        Recipe Dost
      </Text>
      <Text
        selectable
        numberOfLines={1}
        style={[typography.body, { color: colors.onSurfaceVariant }]}
      >
        Save your favorite recipes
      </Text>
    </View>
  )
}

export function UsagePill({
  label,
  isLoading,
  isRefreshing = false,
  hasWarning = false,
  onPress,
}: {
  label: string | null
  isLoading: boolean
  isRefreshing?: boolean
  hasWarning?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityLabel="View AI recipe usage and Premium options"
      accessibilityRole="button"
      accessibilityHint={
        isLoading
          ? 'AI recipe availability is still loading'
          : label ?? 'AI recipe availability is unavailable'
      }
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        top: 0,
        right: 0,
        minWidth: 70,
        minHeight: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: colors.glassElevated,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        opacity: pressed ? 0.76 : 1,
      })}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <AppIcon
            name={hasWarning ? 'warning' : 'usage'}
            color={hasWarning ? colors.warning : colors.primary}
            size={14}
          />
          <Text
            selectable={false}
            numberOfLines={1}
            style={[
              typography.caption,
              {
                color: label ? colors.onSurface : colors.onSurfaceVariant,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {label ?? 'Unavailable'}
          </Text>
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null}
        </>
      )}
    </Pressable>
  )
}

export function SectionHeading({ title }: { title: string }) {
  return (
    <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
      {title}
    </Text>
  )
}

export function OutlinePillButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        ...borders.emphasized,
        backgroundColor: pressed ? colors.primaryWash : 'transparent',
        paddingHorizontal: spacing.lg,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <Text
        selectable={false}
        style={[typography.label, { color: colors.primary, textAlign: 'center' }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function EmptySectionCard({
  title,
  message,
  actionLabel,
  onActionPress,
}: {
  title: string
  message: string
  actionLabel?: string
  onActionPress?: () => void
}) {
  return (
    <View
      style={{
        gap: spacing.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        ...borders.subtle,
        backgroundColor: colors.surfaceContainerLow,
        padding: spacing.cardPadding,
      }}
    >
      <Text
        selectable
        style={[typography.body, { color: colors.onSurface, fontWeight: '700' }]}
      >
        {title}
      </Text>
      <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>
        {message}
      </Text>
      {actionLabel && onActionPress ? (
        <OutlinePillButton label={actionLabel} onPress={onActionPress} />
      ) : null}
    </View>
  )
}

export function SkeletonBar({ width }: { width: `${number}%` }) {
  return (
    <View
      style={{
        width,
        height: 14,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceContainerHighest,
        opacity: 0.72,
      }}
    />
  )
}
