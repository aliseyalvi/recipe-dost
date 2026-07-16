import {
  getWelcomePrimaryAction,
  welcomeSlides,
  type WelcomeHero,
} from '@/features/onboarding/welcome-flow-model'
import { colors, radius, spacing, typography } from '@/theme'
import { AppIcon } from '@/ui/app-icon'
import Constants from 'expo-constants'
import { useEffect, useState, type ReactNode } from 'react'
import {
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  onFinish: () => void
  onSkip: () => void
}

export function WelcomeExperience({ onFinish, onSkip }: Props) {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [stepIndex, setStepIndex] = useState(0)
  const slide = welcomeSlides[stepIndex]
  const topInset = insets.top || Constants.statusBarHeight || 0
  const heroHeight = height < 700 ? 218 : height < 820 ? 252 : 292

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (stepIndex === 0) {
          return false
        }

        setStepIndex((current) => Math.max(0, current - 1))
        return true
      }
    )

    return () => {
      subscription.remove()
    }
  }, [stepIndex])

  const advance = () => {
    const action = getWelcomePrimaryAction(stepIndex)

    if (action.kind === 'complete') {
      onFinish()
      return
    }

    setStepIndex(action.nextStep)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AmbientBackground />

      <View
        style={{
          minHeight: 58,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: topInset + spacing.sm,
          paddingHorizontal: spacing.xl,
        }}
      >
        <Text
          selectable={false}
          style={[
            typography.label,
            {
              color: colors.onSurface,
              fontSize: 13,
              letterSpacing: 1.5,
            },
          ]}
        >
          RECIPE DOST
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip welcome tour"
          hitSlop={8}
          onPress={onSkip}
          style={({ pressed }) => ({
            minWidth: 48,
            minHeight: 48,
            alignItems: 'flex-end',
            justifyContent: 'center',
            opacity: pressed ? 0.62 : 1,
          })}
        >
          <Text
            selectable={false}
            style={[
              typography.body,
              { color: colors.onSurfaceVariant, fontWeight: '600' },
            ]}
          >
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          gap: spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        }}
      >
        <Animated.View
          key={slide.id}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(120)}
          style={{ gap: spacing.xl }}
        >
          <WelcomeHeroCard hero={slide.hero} height={heroHeight} />
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <Text
              selectable
              style={[
                typography.label,
                { color: colors.primary, textAlign: 'center' },
              ]}
            >
              {slide.eyebrow}
            </Text>
            <Text
              selectable
              style={[
                typography.hero,
                {
                  color: colors.onSurface,
                  textAlign: 'center',
                  fontSize: height < 700 ? 29 : typography.hero.fontSize,
                },
              ]}
            >
              {slide.title}
            </Text>
            <Text
              selectable
              style={[
                typography.body,
                {
                  maxWidth: 360,
                  color: colors.textMuted,
                  textAlign: 'center',
                },
              ]}
            >
              {slide.description}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View
        style={{
          gap: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        }}
      >
        <PageIndicators currentStep={stepIndex} />
        <WelcomePrimaryButton
          label={
            stepIndex === welcomeSlides.length - 1 ? 'Get Started' : 'Continue'
          }
          onPress={advance}
        />
      </View>
    </View>
  )
}

function AmbientBackground() {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <View
        style={{
          position: 'absolute',
          top: -120,
          right: -130,
          width: 300,
          height: 300,
          borderRadius: radius.pill,
          backgroundColor: colors.primaryWash,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 80,
          left: -170,
          width: 320,
          height: 320,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(132, 215, 167, 0.035)',
        }}
      />
    </View>
  )
}

function WelcomeHeroCard({ hero, height }: { hero: WelcomeHero; height: number }) {
  return (
    <View
      style={{
        height,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 30,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: '#151316',
        boxShadow: '0 22px 42px rgba(0, 0, 0, 0.36)',
        padding: spacing.xl,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 230,
          height: 230,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(255, 179, 176, 0.06)',
        }}
      />
      {hero === 'intro' ? <IntroHero /> : null}
      {hero === 'save' ? <SaveHero /> : null}
      {hero === 'ai' ? <AiHero /> : null}
      {hero === 'grocery' ? <GroceryHero /> : null}
      {hero === 'ready' ? <ReadyHero /> : null}
    </View>
  )
}

function IntroHero() {
  return (
    <View style={{ alignItems: 'center', gap: spacing.lg }}>
      <View
        style={{
          width: 150,
          height: 150,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.primaryOutline,
          backgroundColor: colors.glassElevated,
        }}
      >
        <View
          style={{
            width: 112,
            height: 112,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceContainerHigh,
          }}
        >
          <AppIcon name="recipe" color={colors.primary} size={52} />
        </View>
        <View style={{ position: 'absolute', right: 8, top: 20 }}>
          <AppIcon name="ai-recipe" color={colors.onSurfaceVariant} size={26} />
        </View>
      </View>
      <HeroCaption>LINK  ·  RECIPE  ·  COOK</HeroCaption>
    </View>
  )
}

function SaveHero() {
  return (
    <View
      style={{
        width: '88%',
        maxWidth: 300,
        gap: spacing.md,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        backgroundColor: colors.glassElevated,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconTile>
          <AppIcon name="link" color={colors.primary} size={22} />
        </IconTile>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <HeroText emphasis>Recipe link received</HeroText>
          <HeroText>Ready to turn into a recipe</HeroText>
        </View>
        <AppIcon name="check" color={colors.success} size={22} />
      </View>
      <View
        style={{
          height: 1,
          backgroundColor: colors.outlineVariant,
          opacity: 0.7,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <AppIcon name="instagram" color={colors.onSurfaceVariant} size={22} />
        <AppIcon name="tiktok" color={colors.onSurfaceVariant} size={22} />
        <AppIcon name="youtube" color={colors.onSurfaceVariant} size={22} />
        <View style={{ flex: 1 }} />
        <HeroCaption>SAVED</HeroCaption>
      </View>
    </View>
  )
}

function AiHero() {
  return (
    <View style={{ width: '90%', maxWidth: 310, alignItems: 'center' }}>
      <View
        style={{
          width: 116,
          height: 116,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.primaryOutline,
          backgroundColor: colors.surfaceContainerHigh,
          boxShadow: '0 0 34px rgba(255, 179, 176, 0.16)',
        }}
      >
        <AppIcon name="ai-recipe" color={colors.primary} size={48} />
      </View>
      <View
        style={{
          width: 1,
          height: 22,
          backgroundColor: colors.primaryOutline,
        }}
      />
      <View style={{ width: '100%', flexDirection: 'row', gap: spacing.sm }}>
        <FeatureTile icon="list" label="Ingredients" />
        <FeatureTile icon="recipe" label="Clear steps" />
        <FeatureTile icon="flame" label="Cook tips" />
      </View>
    </View>
  )
}

function GroceryHero() {
  const items = [
    { label: 'Fresh tomatoes', amount: '500 g', checked: true },
    { label: 'Chicken', amount: '1 kg', checked: false },
    { label: 'Coriander', amount: '1 bunch', checked: false },
  ]

  return (
    <View
      style={{
        width: '92%',
        maxWidth: 320,
        gap: spacing.md,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        backgroundColor: colors.glassElevated,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppIcon name="grocery-list" color={colors.primary} size={22} />
        <HeroText emphasis>Smart grocery list</HeroText>
      </View>
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: item.checked ? colors.primary : colors.outline,
              backgroundColor: item.checked ? colors.primaryWash : 'transparent',
            }}
          >
            {item.checked ? (
              <AppIcon name="check" color={colors.primary} size={17} />
            ) : null}
          </View>
          <HeroText emphasis>{item.label}</HeroText>
          <View style={{ flex: 1 }} />
          <HeroText>{item.amount}</HeroText>
        </View>
      ))}
    </View>
  )
}

function ReadyHero() {
  return (
    <View style={{ alignItems: 'center', gap: spacing.xl }}>
      <View
        style={{
          width: 154,
          height: 154,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 42,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.primaryOutline,
          backgroundColor: colors.surfaceContainerHigh,
          transform: [{ rotate: '-2deg' }],
          boxShadow: '0 18px 32px rgba(0, 0, 0, 0.28)',
        }}
      >
        <AppIcon name="recipe" color={colors.primary} size={62} />
        <View style={{ position: 'absolute', right: 22, top: 20 }}>
          <AppIcon name="ai-recipe" color={colors.success} size={28} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <MiniPill label="Save" />
        <MiniPill label="Cook" />
        <MiniPill label="Shop" />
      </View>
    </View>
  )
}

function PageIndicators({ currentStep }: { currentStep: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Welcome step ${currentStep + 1} of ${welcomeSlides.length}`}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
    >
      {welcomeSlides.map((slide, index) => (
        <View
          key={slide.id}
          style={{
            width: index === currentStep ? 24 : 7,
            height: 7,
            borderRadius: radius.pill,
            backgroundColor:
              index === currentStep ? colors.primary : colors.surfaceContainerHighest,
          }}
        />
      ))}
    </View>
  )
}

function WelcomePrimaryButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        opacity: pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <Text
        selectable={false}
        style={[
          typography.body,
          { color: colors.onPrimary, fontWeight: '800' },
        ]}
      >
        {label}
      </Text>
      <AppIcon name="forward" color={colors.onPrimary} size={20} />
    </Pressable>
  )
}

function FeatureTile({
  icon,
  label,
}: {
  icon: 'list' | 'recipe' | 'flame'
  label: string
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 74,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        backgroundColor: colors.surfaceContainerLow,
        padding: spacing.sm,
      }}
    >
      <AppIcon name={icon} color={colors.onSurfaceVariant} size={22} />
      <Text
        selectable={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[typography.caption, { color: colors.onSurface, textAlign: 'center' }]}
      >
        {label}
      </Text>
    </View>
  )
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: colors.primaryWash,
      }}
    >
      {children}
    </View>
  )
}

function MiniPill({ label }: { label: string }) {
  return (
    <View
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.primaryOutlineSoft,
        backgroundColor: colors.glassBadge,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <HeroCaption>{label.toUpperCase()}</HeroCaption>
    </View>
  )
}

function HeroText({
  children,
  emphasis = false,
}: {
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <Text
      selectable={false}
      numberOfLines={1}
      style={[
        typography.caption,
        {
          color: emphasis ? colors.onSurface : colors.textMuted,
          fontWeight: emphasis ? '700' : '500',
        },
      ]}
    >
      {children}
    </Text>
  )
}

function HeroCaption({ children }: { children: ReactNode }) {
  return (
    <Text
      selectable={false}
      style={[typography.label, { color: colors.onSurfaceVariant }]}
    >
      {children}
    </Text>
  )
}
