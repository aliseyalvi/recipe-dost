import { Button } from '@/ui/button'
import { colors, spacing, typography } from '@/theme'
import { Text, View } from 'react-native'

type Props = {
  title?: string
  message: string
  retryLabel?: string
  onRetry?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  retryLabel = 'Try again',
  onRetry,
  secondaryActionLabel,
  onSecondaryAction,
}: Props) {
  return (
    <View
      style={{
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.danger,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: colors.dangerSurface,
        padding: spacing.xl,
      }}
    >
      <Text selectable style={[typography.heading, { color: colors.danger }]}>
        {title}
      </Text>
      <Text selectable style={[typography.body, { color: colors.text }]}>
        {message}
      </Text>
      {onRetry ? (
        <Button label={retryLabel} onPress={onRetry} variant="secondary" />
      ) : null}
      {onSecondaryAction && secondaryActionLabel ? (
        <Button
          label={secondaryActionLabel}
          onPress={onSecondaryAction}
          variant="ghost"
        />
      ) : null}
    </View>
  )
}
