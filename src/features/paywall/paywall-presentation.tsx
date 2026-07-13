import type {
  PaywallPlan,
  PaywallUsage,
} from '@/features/paywall/paywall-model'
import { borders, colors, radius, shadows, spacing, typography } from '@/theme'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type PaywallFeedbackTone = 'error' | 'info' | 'success'

export function PaywallSheet({
  children,
  footer,
  closeDisabled = false,
  onClose,
}: {
  children: ReactNode
  footer?: ReactNode
  closeDisabled?: boolean
  onClose: (source: 'backdrop' | 'close_button') => void
}) {
  const { height } = useWindowDimensions()

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'transparent',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close Premium options"
        disabled={closeDisabled}
        onPress={() => onClose('backdrop')}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.76)',
        }}
      />
      <View
        style={{
          width: '100%',
          maxWidth: 720,
          height: Math.min(Math.max(height * 0.9, 560), 920),
          maxHeight: '94%',
          alignSelf: 'center',
          overflow: 'hidden',
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: colors.primaryOutlineSoft,
          backgroundColor: colors.surfaceContainerLowest,
          ...shadows.floating,
        }}
      >
        <View
          style={{
            minHeight: 58,
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomWidth: 1,
            borderColor: 'rgba(91, 64, 63, 0.24)',
          }}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 48,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.outlineVariant,
              opacity: 0.8,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Premium options"
            accessibilityState={{ disabled: closeDisabled }}
            disabled={closeDisabled}
            hitSlop={8}
            onPress={() => onClose('close_button')}
            style={({ pressed }) => ({
              position: 'absolute',
              top: 7,
              right: spacing.md,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.primaryOutlineSoft,
              backgroundColor: colors.glassElevated,
              opacity: closeDisabled ? 0.45 : pressed ? 0.68 : 1,
            })}
          >
            <Text
              selectable={false}
              style={{ color: colors.onSurface, fontSize: 26, lineHeight: 28 }}
            >
              ×
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: spacing.xl,
            paddingHorizontal: spacing.card,
            paddingTop: spacing.card,
            paddingBottom: spacing.xl,
          }}
        >
          {children}
        </ScrollView>
        {footer}
      </View>
    </View>
  )
}

export function PaywallHero({ isPremiumActive }: { isPremiumActive: boolean }) {
  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.primaryOutlineSoft,
          backgroundColor: colors.primaryWash,
        }}
      >
        <Text selectable={false} style={{ color: colors.primary, fontSize: 24 }}>
          ✦
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.label, { color: colors.primary }]}>
          RECIPE DOST PREMIUM
        </Text>
        <Text
          selectable
          style={[
            typography.hero,
            {
              color: colors.onSurface,
              fontStyle: 'italic',
              letterSpacing: -0.4,
            },
          ]}
        >
          {isPremiumActive ? 'Premium is active' : 'Free vs Premium'}
        </Text>
        <Text selectable style={[typography.body, { color: colors.textMuted }]}>
          {isPremiumActive
            ? 'Your Premium access is active on this app profile.'
            : 'Save links and search your Library on either plan. AI recipe-card access is different.'}
        </Text>
      </View>
    </View>
  )
}

export function PlanComparisonTable() {
  const rows = [
    ['Save recipe links', 'Included', 'Included'],
    ['Search your Library', 'Included', 'Included'],
    ['AI recipe cards', '3 total', '100/month'],
    ['Urdu + English recipe help', 'On 3 AI cards', 'On 100/month'],
    ['Ingredients and steps', 'On 3 AI cards', 'On 100/month'],
    ['Grocery lists', 'From free AI cards', 'From Premium AI cards'],
  ] as const

  return (
    <View style={{ gap: spacing.md }}>
      <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
        Compare plans
      </Text>
      <View
        style={{
          overflow: 'hidden',
          borderRadius: radius.card,
          borderCurve: 'continuous',
          ...borders.subtle,
          backgroundColor: colors.glassSurface,
        }}
      >
        <ComparisonRow label="" free="Free" premium="Premium" header />
        {rows.map(([label, free, premium]) => (
          <ComparisonRow
            key={label}
            label={label}
            free={free}
            premium={premium}
          />
        ))}
      </View>
    </View>
  )
}

export function UsageProgress({
  usage,
  isLoading,
  hasError,
  isRetrying = false,
  onRetry,
}: {
  usage: PaywallUsage | null
  isLoading: boolean
  hasError: boolean
  isRetrying?: boolean
  onRetry: () => void
}) {
  if (isLoading && !usage) {
    return <UsageLoadingState />
  }

  if (hasError || !usage) {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{
          gap: spacing.md,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          ...borders.subtle,
          backgroundColor: colors.glassSurface,
          padding: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.body, { color: colors.onSurface, fontWeight: '800' }]}>
            Usage unavailable
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            Plans remain available while AI usage refreshes.
          </Text>
        </View>
        <PaywallButton
          label={isRetrying ? 'Retrying…' : 'Retry usage'}
          variant="secondary"
          busy={isRetrying}
          onPress={onRetry}
        />
      </View>
    )
  }

  return (
    <View
      style={{
        gap: spacing.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        experimental_backgroundImage:
          'linear-gradient(135deg, rgba(255, 179, 176, 0.11) 0%, rgba(30, 31, 35, 0.96) 56%, rgba(18, 19, 23, 0.98) 100%)',
        padding: spacing.lg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
          <Text selectable style={[typography.label, { color: colors.primary }]}>
            {usage.title}
          </Text>
          <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
            {usage.summary}
          </Text>
        </View>
        <Text
          selectable
          style={[
            typography.caption,
            { color: colors.onSurfaceVariant, fontVariant: ['tabular-nums'] },
          ]}
        >
          {usage.remainingText}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={usage.accessibilityLabel}
        accessibilityValue={{
          min: 0,
          max: usage.limit,
          now: usage.used,
          text: usage.summary,
        }}
        style={{
          height: 8,
          overflow: 'hidden',
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceContainerHighest,
        }}
      >
        <View
          style={{
            width: `${usage.progress * 100}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
          }}
        />
      </View>
      {usage.reservedText ? (
        <Text selectable style={[typography.caption, { color: colors.tertiary }]}>
          {usage.reservedText}
        </Text>
      ) : null}
    </View>
  )
}

export function PaywallPlanCard({
  plan,
  priceSummary,
  introOfferText,
  selected,
  disabled,
  onPress,
}: {
  plan: PaywallPlan
  priceSummary: string
  introOfferText: string | null
  selected: boolean
  disabled: boolean
  onPress: () => void
}) {
  const label = plan === 'yearly' ? 'Yearly' : 'Monthly'

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label} plan, ${priceSummary}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={`paywall-${plan}-button`}
      style={({ pressed }) => ({
        gap: spacing.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.primary : colors.outlineVariant,
        backgroundColor: selected ? colors.primaryWash : colors.glassElevated,
        padding: spacing.lg,
        opacity: disabled ? 0.48 : pressed ? 0.76 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 22,
              height: 22,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              borderWidth: 2,
              borderColor: selected ? colors.primary : colors.outline,
            }}
          >
            {selected ? (
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: radius.pill,
                  backgroundColor: colors.primary,
                }}
              />
            ) : null}
          </View>
          <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
            {label}
          </Text>
        </View>
        {plan === 'yearly' ? <PaywallBadge label="Best value" /> : null}
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text
          selectable
          style={[
            typography.body,
            { color: colors.onSurface, fontWeight: '800', fontVariant: ['tabular-nums'] },
          ]}
        >
          {priceSummary}
        </Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          100 AI recipe cards each month
        </Text>
        {introOfferText ? (
          <Text selectable style={[typography.caption, { color: colors.tertiary }]}>
            {introOfferText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export function PaywallPlansLoading({
  isRestoring,
  onRestore,
  onLater,
}: {
  isRestoring: boolean
  onRestore: () => void
  onLater: () => void
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View
        accessibilityLiveRegion="polite"
        style={{
          gap: spacing.lg,
          borderRadius: radius.card,
          ...borders.subtle,
          backgroundColor: colors.glassSurface,
          padding: spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <ActivityIndicator color={colors.primary} />
          <Text selectable style={[typography.body, { color: colors.onSurface }]}>
            Loading Google Play plans…
          </Text>
        </View>
        <SkeletonBlock height={88} />
        <SkeletonBlock height={88} />
      </View>
      <PaywallButton
        label={isRestoring ? 'Restoring…' : 'Restore purchases'}
        variant="secondary"
        busy={isRestoring}
        onPress={onRestore}
      />
      <PaywallButton label="Maybe later" variant="ghost" onPress={onLater} />
    </View>
  )
}

export function PaywallUnavailable({
  isRetrying,
  isRestoring,
  feedback,
  onRetry,
  onRestore,
  onLater,
}: {
  isRetrying: boolean
  isRestoring: boolean
  feedback?: ReactNode
  onRetry: () => void
  onRestore: () => void
  onLater: () => void
}) {
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={{
        gap: spacing.lg,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.error,
        backgroundColor: colors.dangerSurface,
        padding: spacing.lg,
      }}
    >
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
          Premium plans are unavailable
        </Text>
        <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>
          We could not load Google Play plans right now.
        </Text>
      </View>
      {feedback}
      <PaywallButton
        label={isRetrying ? 'Retrying…' : 'Retry'}
        busy={isRetrying}
        onPress={onRetry}
      />
      <PaywallButton
        label={isRestoring ? 'Restoring…' : 'Restore purchases'}
        variant="secondary"
        busy={isRestoring}
        disabled={isRetrying}
        onPress={onRestore}
      />
      <PaywallButton
        label="Maybe later"
        variant="ghost"
        disabled={isRetrying || isRestoring}
        onPress={onLater}
      />
    </View>
  )
}

export function PremiumActivePanel({
  usageText,
  currentPlan,
  feedback,
  isManaging,
  isRestoring,
  onManage,
  onRestore,
  onClose,
}: {
  usageText: string
  currentPlan: string | null
  feedback?: ReactNode
  isManaging: boolean
  isRestoring: boolean
  onManage: () => void
  onRestore: () => void
  onClose: () => void
}) {
  return (
    <View
      style={{
        gap: spacing.lg,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: colors.glassSurface,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: colors.primaryWash,
          }}
        >
          <Text selectable={false} style={{ color: colors.primary, fontSize: 22 }}>
            ✦
          </Text>
        </View>
        <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
          <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
            Premium is active
          </Text>
          <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
            {currentPlan ? `${currentPlan} · ${usageText}` : usageText}
          </Text>
        </View>
      </View>
      {feedback}
      <PaywallButton
        label={isManaging ? 'Opening Google Play…' : 'Manage subscription'}
        busy={isManaging}
        disabled={isRestoring}
        onPress={onManage}
      />
      <PaywallButton
        label={isRestoring ? 'Restoring…' : 'Restore purchases'}
        variant="secondary"
        busy={isRestoring}
        disabled={isManaging}
        onPress={onRestore}
      />
      <PaywallButton
        label="Close"
        variant="ghost"
        disabled={isManaging || isRestoring}
        onPress={onClose}
      />
    </View>
  )
}

export function PaywallPurchaseFooter({
  plan,
  priceSummary,
  isPurchasing,
  isRestoring,
  onPurchase,
  onRestore,
  onLater,
}: {
  plan: PaywallPlan
  priceSummary: string
  isPurchasing: boolean
  isRestoring: boolean
  onPurchase: () => void
  onRestore: () => void
  onLater: () => void
}) {
  const insets = useSafeAreaInsets()
  const planLabel = plan === 'yearly' ? 'Yearly' : 'Monthly'

  return (
    <View
      style={{
        gap: spacing.sm,
        borderTopWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: 'rgba(13, 14, 18, 0.98)',
        paddingHorizontal: spacing.card,
        paddingTop: spacing.md,
        paddingBottom: Math.max(insets.bottom, spacing.md),
      }}
    >
      <View
        accessible
        accessibilityLabel={`${planLabel} plan, ${priceSummary}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          {planLabel} plan
        </Text>
        <Text
          selectable
          style={[
            typography.caption,
            { color: colors.onSurface, fontWeight: '800', fontVariant: ['tabular-nums'] },
          ]}
        >
          {priceSummary}
        </Text>
      </View>
      <PaywallButton
        label={isPurchasing ? 'Processing purchase…' : `Continue with ${planLabel}`}
        accessibilityLabel={`${
          isPurchasing ? 'Processing purchase' : `Continue with ${planLabel}`
        }, ${priceSummary}`}
        busy={isPurchasing}
        disabled={isRestoring}
        onPress={onPurchase}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <PaywallButton
            label={isRestoring ? 'Restoring…' : 'Restore purchases'}
            variant="secondary"
            busy={isRestoring}
            disabled={isPurchasing}
            onPress={onRestore}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PaywallButton
            label="Maybe later"
            variant="ghost"
            disabled={isPurchasing || isRestoring}
            onPress={onLater}
          />
        </View>
      </View>
    </View>
  )
}

export function PaywallFeedback({
  message,
  tone = 'info',
}: {
  message: string
  tone?: PaywallFeedbackTone
}) {
  const foreground = tone === 'error'
    ? colors.error
    : tone === 'success'
      ? colors.success
      : colors.tertiary
  const backgroundColor = tone === 'error'
    ? colors.dangerSurface
    : tone === 'success'
      ? colors.successContainer
      : 'rgba(0, 106, 133, 0.20)'

  return (
    <View
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: foreground,
        backgroundColor,
        padding: spacing.md,
      }}
    >
      <Text selectable style={[typography.caption, { color: foreground }]}>
        {message}
      </Text>
    </View>
  )
}

function ComparisonRow({
  label,
  free,
  premium,
  header = false,
}: {
  label: string
  free: string
  premium: string
  header?: boolean
}) {
  return (
    <View
      style={{
        minHeight: header ? 44 : 64,
        flexDirection: 'row',
        borderTopWidth: header ? 0 : 1,
        borderColor: 'rgba(91, 64, 63, 0.38)',
        backgroundColor: header
          ? colors.surfaceContainerLow
          : colors.glassSurface,
      }}
    >
      <ComparisonCell value={label} flex={1.25} muted={!header} header={header} />
      <ComparisonCell value={free} flex={0.8} header={header} />
      <ComparisonCell value={premium} flex={1} accent header={header} />
    </View>
  )
}

function ComparisonCell({
  value,
  flex,
  muted = false,
  accent = false,
  header = false,
}: {
  value: string
  flex: number
  muted?: boolean
  accent?: boolean
  header?: boolean
}) {
  return (
    <View
      style={{
        flex,
        justifyContent: 'center',
        borderLeftWidth: flex === 1.25 ? 0 : 1,
        borderColor: 'rgba(91, 64, 63, 0.38)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      <Text
        selectable
        style={[
          typography.caption,
          {
            color: accent
              ? colors.primary
              : muted
                ? colors.textMuted
                : colors.onSurface,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: header ? '800' : accent ? '700' : '500',
            textAlign: flex === 1.25 ? 'left' : 'center',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function UsageLoadingState() {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        gap: spacing.md,
        borderRadius: radius.card,
        ...borders.subtle,
        backgroundColor: colors.glassSurface,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <ActivityIndicator color={colors.primary} />
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
          Loading AI recipe usage…
        </Text>
      </View>
      <SkeletonBlock height={8} />
    </View>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height,
        borderRadius: height <= 10 ? radius.pill : radius.md,
        backgroundColor: colors.surfaceContainerHigh,
        opacity: 0.72,
      }}
    />
  )
}

function PaywallBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        borderRadius: radius.pill,
        backgroundColor: colors.primaryContainer,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text selectable={false} style={[typography.caption, { color: colors.onPrimaryContainer, fontWeight: '800' }]}>
        {label}
      </Text>
    </View>
  )
}

function PaywallButton({
  label,
  accessibilityLabel,
  variant = 'primary',
  busy = false,
  disabled = false,
  onPress,
}: {
  label: string
  accessibilityLabel?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  busy?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const isDisabled = disabled || busy
  const backgroundColor = variant === 'primary'
    ? colors.primaryContainer
    : variant === 'secondary'
      ? colors.glassElevated
      : 'transparent'
  const borderColor = variant === 'primary'
    ? colors.primaryContainer
    : variant === 'secondary'
      ? colors.primaryOutlineSoft
      : 'transparent'
  const foreground = variant === 'primary'
    ? colors.onPrimaryContainer
    : variant === 'secondary'
      ? colors.onSurface
      : colors.onSurfaceVariant

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor,
        backgroundColor,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        opacity: isDisabled ? 0.48 : pressed ? 0.76 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={foreground} size="small" /> : null}
      <Text
        selectable={false}
        numberOfLines={2}
        style={[
          typography.body,
          { color: foreground, fontWeight: '800', textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}
