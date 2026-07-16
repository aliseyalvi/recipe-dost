import { reportError } from '@/lib/observability/sentry'
import { colors, spacing, typography } from '@/theme'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportError(error)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          padding: spacing.xl,
          backgroundColor: colors.background,
        }}
      >
        <Text style={[typography.heading, { color: colors.text }]}>Recipe Dost hit a snag</Text>
        <Text
          style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}
        >
          Please try this screen again. If the problem continues, restart the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            backgroundColor: colors.primary,
          }}
        >
          <Text
            style={[typography.body, { color: colors.background, fontWeight: '800' }]}
          >
            Try Again
          </Text>
        </Pressable>
      </View>
    )
  }
}
