import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { borders, colors, radius, spacing, typography } from '@/theme'
import type { Href } from 'expo-router'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Constants from 'expo-constants'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AppIcon,
  getPlatformIconName,
  type AppIconName,
} from '@/ui/app-icon'

export function RecipeDetailScaffold({
  title,
  fallbackRoute,
  rightActions,
  children,
}: {
  title: string
  fallbackRoute: Href
  rightActions?: ReactNode
  children: ReactNode
}) {
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
          paddingTop: topInset + spacing.sm,
          paddingBottom: spacing.xxxl + insets.bottom,
        }}
      >
        <RecipeDetailHeader
          title={title}
          fallbackRoute={fallbackRoute}
          rightActions={rightActions}
        />
        {children}
      </ScrollView>
    </View>
  )
}

function RecipeDetailHeader({
  title,
  fallbackRoute,
  rightActions,
}: {
  title: string
  fallbackRoute: Href
  rightActions?: ReactNode
}) {
  const router = useRouter()
  const { track } = usePostHog()
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string | string[]
  }>()
  const returnToRoute = getSafeRoute(returnTo)

  const goBack = () => {
    track('navigation_back_tapped')

    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace(returnToRoute ?? fallbackRoute)
  }

  return (
    <View
      style={{
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        paddingBottom: spacing.sm,
      }}
    >
      <HeaderIconButton label="Go back" icon="back" onPress={goBack} />
      <Text
        selectable
        numberOfLines={1}
        style={[
          typography.heading,
          {
            position: 'absolute',
            right: 60,
            left: 60,
            color: colors.primary,
            textAlign: 'center',
          },
        ]}
      >
        {title}
      </Text>
      <View
        style={{
          minWidth: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: spacing.xs,
        }}
      >
        {rightActions}
      </View>
    </View>
  )
}

export function HeaderIconButton({
  label,
  icon,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string
  icon: AppIconName
  selected?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: pressed ? colors.primaryWash : 'transparent',
        opacity: pressed || disabled ? 0.62 : 1,
      })}
    >
      <AppIcon
        name={icon}
        color={selected ? colors.primary : colors.onSurface}
        size={22}
      />
    </Pressable>
  )
}

export function DetailUsagePill({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View AI recipe usage and Premium options"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: colors.primaryWash,
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.68 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <AppIcon name="usage" color={colors.primary} size={15} />
        <Text selectable={false} style={[typography.caption, { color: colors.primary, fontWeight: '800' }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

export function RecipeAnalyzingState({
  kind,
  statusLabel,
  progress,
  platformLabel,
  onGoToLibrary,
  onWaitHere,
  onOpenOriginal,
  isChecking = false,
}: {
  kind: 'metadata' | 'ai'
  statusLabel: string
  progress?: number | null
  platformLabel?: string | null
  onGoToLibrary: () => void
  onWaitHere: () => void
  onOpenOriginal?: () => void
  isChecking?: boolean
}) {
  const resolvedProgress = normalizeProgress(progress)
  const isMetadata = kind === 'metadata'

  return (
    <View
      style={{
        minHeight: 620,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xxl,
        paddingVertical: spacing.xl,
      }}
    >
      <View
        style={{
          width: 236,
          height: 236,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.primaryOutlineSoft,
        }}
      >
        <View style={{ position: 'absolute', top: 35, right: 52 }}>
          <AppIcon name="clock" color={colors.outline} size={25} />
        </View>
        <View style={{ position: 'absolute', bottom: 45, left: 48 }}>
          <AppIcon name="ai-recipe" color={colors.outline} size={23} />
        </View>
        <View
          style={{
            width: 104,
            height: 104,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.primaryOutlineSoft,
            backgroundColor: colors.primaryWash,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <View style={{ position: 'absolute' }}>
            <AppIcon
              name={isMetadata ? 'link' : 'ai-recipe'}
              color={colors.primary}
              size={28}
            />
          </View>
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.md }}>
        {platformLabel ? (
          <Text selectable style={[typography.label, { color: colors.onSurfaceVariant }]}>
            {platformLabel}
          </Text>
        ) : null}
        <Text
          selectable
          style={[
            typography.hero,
            {
              color: colors.onSurface,
              fontStyle: 'italic',
              textAlign: 'center',
            },
          ]}
        >
          {isMetadata ? 'Preparing Preview…' : 'Analyzing Reel…'}
        </Text>
        <Text
          selectable
          style={[
            typography.label,
            {
              maxWidth: 310,
              color: colors.primary,
              letterSpacing: 2.2,
              textAlign: 'center',
            },
          ]}
        >
          {isMetadata
            ? 'RECIPE DOST IS READING THE SOURCE'
            : 'RECIPE DOST INTELLIGENCE ACTIVE'}
        </Text>
        <Text
          selectable
          style={[typography.body, { maxWidth: 330, color: colors.onSurfaceVariant, textAlign: 'center' }]}
        >
          {isMetadata
            ? 'You can go back. We’ll update your Library when it’s ready.'
            : 'You can leave this screen. Your recipe card will appear in Library.'}
        </Text>
        <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant }]}>
          {statusLabel}
        </Text>
      </View>

      <View style={{ width: '78%', gap: spacing.xs }}>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={
            resolvedProgress === null
              ? undefined
              : { min: 0, max: 100, now: resolvedProgress }
          }
          style={{
            overflow: 'hidden',
            height: 5,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceContainerHigh,
          }}
        >
          <View
            style={{
              width: `${resolvedProgress ?? 38}%`,
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: colors.primaryContainer,
              opacity: resolvedProgress === null ? 0.72 : 1,
            }}
          />
        </View>
        {resolvedProgress !== null ? (
          <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
            {resolvedProgress}% complete
          </Text>
        ) : null}
      </View>

      <View style={{ width: '100%', gap: spacing.sm }}>
        <EditorialButton label="Go to Library" variant="primary" onPress={onGoToLibrary} />
        <EditorialButton
          label={isChecking ? 'Checking latest status…' : 'Wait here'}
          variant="secondary"
          disabled={isChecking}
          onPress={onWaitHere}
        />
        {onOpenOriginal ? (
          <EditorialButton label="Open Original" variant="ghost" onPress={onOpenOriginal} />
        ) : null}
      </View>
    </View>
  )
}

export function RecipeMetadataState({
  thumbnailUrl,
  title,
  creator,
  platformLabel,
  durationLabel,
  isFavorite,
  isFavoriteUpdating,
  availabilityText,
  generateLabel,
  generateDisabled,
  onGenerate,
  onOpenOriginal,
  onToggleFavorite,
}: {
  thumbnailUrl: string | null
  title: string
  creator?: string | null
  platformLabel: string
  durationLabel?: string | null
  isFavorite: boolean
  isFavoriteUpdating: boolean
  availabilityText?: string | null
  generateLabel: string
  generateDisabled: boolean
  onGenerate: () => void
  onOpenOriginal: () => void
  onToggleFavorite: () => void
}) {
  return (
    <View style={{ gap: spacing.xxl }}>
      <RecipeSourceHero
        thumbnailUrl={thumbnailUrl}
        durationLabel={durationLabel}
        onOpenOriginal={onOpenOriginal}
      />
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Text selectable style={[typography.hero, { color: colors.onSurface, textAlign: 'center' }]}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
          <DetailChip icon={getPlatformIconName(platformLabel)} label={platformLabel} accent />
          {creator ? <DetailChip icon="creator" label={creator} /> : null}
          {durationLabel ? <DetailChip icon="clock" label={durationLabel} /> : null}
        </View>
      </View>
      <View style={{ gap: spacing.md }}>
        <EditorialButton
          accessibilityLabel="Generate AI Recipe"
          icon="ai-recipe"
          label={generateLabel}
          variant="primary"
          disabled={generateDisabled}
          onPress={onGenerate}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <EditorialButton icon="external" label="Open Original" variant="secondary" onPress={onOpenOriginal} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            disabled={isFavoriteUpdating}
            onPress={onToggleFavorite}
            style={({ pressed }) => ({
              width: 56,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              ...borders.subtle,
              backgroundColor: colors.glassElevated,
              opacity: pressed || isFavoriteUpdating ? 0.62 : 1,
            })}
          >
            <AppIcon
              name={isFavorite ? 'heart' : 'heart-outline'}
              color={colors.primary}
              size={24}
            />
          </Pressable>
        </View>
        {availabilityText ? (
          <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
            {availabilityText}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function RecipeSourceHero({
  thumbnailUrl,
  durationLabel,
  onOpenOriginal,
}: {
  thumbnailUrl: string | null
  durationLabel?: string | null
  onOpenOriginal: () => void
}) {
  const { width } = useWindowDimensions()
  const heroHeight = Math.min(Math.max(380, (width - spacing.mobileMargin * 2) * 1.42), 520)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open original video"
      onPress={onOpenOriginal}
      style={({ pressed }) => ({
        height: heroHeight,
        overflow: 'hidden',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        ...borders.subtle,
        backgroundColor: colors.surfaceContainer,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <RecipeImagePlaceholder label="RD" />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(4, 4, 5, 0.88) 0%, rgba(7, 7, 8, 0.08) 62%, rgba(7, 7, 8, 0.04) 100%)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: spacing.lg,
          bottom: spacing.lg,
          left: spacing.lg,
          minHeight: 78,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.14)',
          backgroundColor: 'rgba(18, 19, 23, 0.84)',
          padding: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.label, { color: colors.primary }]}>
            RECIPE OVERVIEW
          </Text>
          {durationLabel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <AppIcon name="clock" color={colors.onSurface} size={14} />
              <Text selectable style={[typography.caption, { color: colors.onSurface }]}>
                {durationLabel} duration
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={{
            width: 46,
            height: 46,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
          }}
        >
          <AppIcon name="play" color={colors.onSurface} size={23} />
        </View>
      </View>
    </Pressable>
  )
}

export function AiRecipeHero({
  thumbnailUrl,
  title,
  tags,
  onTagPress,
}: {
  thumbnailUrl: string | null
  title: string
  tags: string[]
  onTagPress?: (tag: string) => void
}) {
  return (
    <View
      style={{
        height: 430,
        overflow: 'hidden',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.surfaceContainer,
      }}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <RecipeImagePlaceholder label="AI" />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(4, 4, 5, 0.98) 0%, rgba(7, 7, 8, 0.44) 48%, rgba(7, 7, 8, 0.08) 100%)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: spacing.lg,
          bottom: spacing.xl,
          left: spacing.lg,
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Text selectable style={[typography.label, { color: colors.primary, letterSpacing: 1.8 }]}>
          AI RECIPE
        </Text>
        <Text selectable style={[typography.hero, { color: '#FFFFFF', textAlign: 'center' }]}>
          {title}
        </Text>
        {tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
            {tags.slice(0, 4).map((tag) => (
              onTagPress ? (
                <Pressable
                  key={tag}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${formatLabel(tag)} recipes`}
                  onPress={() => onTagPress(tag)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
                >
                  <DetailChip label={formatLabel(tag)} />
                </Pressable>
              ) : (
                <DetailChip key={tag} label={formatLabel(tag)} />
              )
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

export function RecipeStatGrid({
  stats,
}: {
  stats: { icon: AppIconName; label: string; value: string }[]
}) {
  if (stats.length === 0) {
    return null
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {stats.map((stat) => (
        <View
          key={`${stat.label}-${stat.value}`}
          style={{
            minHeight: 96,
            flexBasis: '46%',
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            borderRadius: radius.md,
            ...borders.subtle,
            backgroundColor: colors.surfaceContainerLow,
            padding: spacing.md,
          }}
        >
          <AppIcon name={stat.icon} color={colors.primary} size={19} />
          <Text selectable style={[typography.label, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
            {stat.label}
          </Text>
          <Text selectable style={[typography.body, { color: colors.onSurface, fontWeight: '800', textAlign: 'center' }]}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function RecipeFailedState({
  kind,
  message,
  canRetry,
  onRetry,
  onOpenOriginal,
  onGoToLibrary,
}: {
  kind: 'metadata' | 'ai'
  message: string
  canRetry: boolean
  onRetry: () => void
  onOpenOriginal?: () => void
  onGoToLibrary: () => void
}) {
  return (
    <View
      style={{
        minHeight: 520,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xl,
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.error,
          backgroundColor: colors.dangerSurface,
        }}
      >
        <AppIcon name="warning" color={colors.error} size={42} />
      </View>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Text selectable style={[typography.hero, { color: colors.onSurface, textAlign: 'center' }]}>
          {kind === 'metadata' ? 'Could not prepare this recipe' : 'AI recipe failed'}
        </Text>
        <Text selectable style={[typography.body, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
          {message}
        </Text>
      </View>
      <View style={{ width: '100%', gap: spacing.sm }}>
        {canRetry ? <EditorialButton label="Retry" variant="primary" onPress={onRetry} /> : null}
        {onOpenOriginal ? <EditorialButton label="Open Original" variant="secondary" onPress={onOpenOriginal} /> : null}
        <EditorialButton label="Back to Library" variant="ghost" onPress={onGoToLibrary} />
      </View>
    </View>
  )
}

export function EditorialSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={[typography.caption, { color: colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  )
}

export function EditorialButton({
  label,
  icon,
  accessibilityLabel,
  variant,
  disabled = false,
  onPress,
}: {
  label: string
  icon?: AppIconName
  accessibilityLabel?: string
  variant: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  onPress: () => void
}) {
  const isPrimary = variant === 'primary'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radius.card,
        borderWidth: variant === 'ghost' ? 0 : 1,
        borderColor: isPrimary ? colors.primaryContainer : colors.primaryOutlineSoft,
        backgroundColor: isPrimary
          ? colors.primaryContainer
          : variant === 'secondary'
            ? colors.glassElevated
            : 'transparent',
        paddingHorizontal: spacing.lg,
        opacity: pressed || disabled ? 0.62 : 1,
      })}
    >
      {icon ? (
        <AppIcon
          name={icon}
          color={isPrimary ? colors.onPrimaryContainer : colors.primary}
          size={19}
        />
      ) : null}
      <Text
        selectable={false}
        style={[
          typography.body,
          {
            color: isPrimary ? colors.onPrimaryContainer : colors.onSurface,
            fontWeight: '800',
            textAlign: 'center',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function DetailChip({
  icon,
  label,
  accent = false,
}: {
  icon?: AppIconName
  label: string
  accent?: boolean
}) {
  return (
    <View
      style={{
        minHeight: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: accent ? colors.primaryOutlineSoft : 'rgba(255, 255, 255, 0.12)',
        backgroundColor: colors.glassElevated,
        paddingHorizontal: spacing.md,
      }}
    >
      {icon ? (
        <AppIcon
          name={icon}
          color={accent ? colors.primary : colors.onSurfaceVariant}
          size={14}
        />
      ) : null}
      <Text selectable style={[typography.caption, { color: accent ? colors.primary : colors.onSurface }]}>
        {label}
      </Text>
    </View>
  )
}

function RecipeImagePlaceholder({ label }: { label: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceContainerHigh,
      }}
    >
      <Text selectable={false} style={[typography.hero, { color: colors.onSurfaceVariant, opacity: 0.64 }]}>
        {label}
      </Text>
    </View>
  )
}

function normalizeProgress(progress: number | null | undefined) {
  return typeof progress === 'number' && Number.isFinite(progress)
    ? Math.min(100, Math.max(0, Math.round(progress)))
    : null
}

function getSafeRoute(value: string | string[] | undefined) {
  const route = Array.isArray(value) ? value[0] : value

  return route && route.startsWith('/') && !route.startsWith('//')
    ? (route as Href)
    : null
}

function formatLabel(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
