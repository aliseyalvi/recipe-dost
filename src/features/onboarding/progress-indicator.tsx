import { colors, radius, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type Props = {
  currentStep: number
  totalSteps: number
}

export function ProgressIndicator({ currentStep, totalSteps }: Props) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        selectable
        style={[
          typography.caption,
          { color: colors.textMuted, fontVariant: ['tabular-nums'] },
        ]}
      >
        Step {currentStep} of {totalSteps}
      </Text>
      <View
        style={{
          height: 8,
          overflow: 'hidden',
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <View
          style={{
            width: `${(currentStep / totalSteps) * 100}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
          }}
        />
      </View>
    </View>
  )
}
