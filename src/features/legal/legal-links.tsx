import { getLegalUrl, type LegalLinkType } from '@/config/legal'
import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { colors, spacing, typography } from '@/theme'
import { useState } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'

const labels: Record<LegalLinkType, string> = {
  privacy_policy: 'Privacy Policy',
  terms: 'Terms',
  account_deletion: 'Account deletion',
  support: 'Support',
}

export async function openLegalUrl(type: LegalLinkType) {
  try {
    const url = getLegalUrl(type)
    if (!url || !(await Linking.canOpenURL(url))) return false
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

export function LegalLinks({ types }: { types: readonly LegalLinkType[] }) {
  const { trackEvent } = usePostHog()
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md }}>
        {types.map((type) => {
          const configured = Boolean(getLegalUrl(type))
          return (
            <Pressable
              key={type}
              accessibilityRole="link"
              accessibilityState={{ disabled: !configured }}
              disabled={!configured}
              onPress={() => {
                setFailureMessage(null)
                void openLegalUrl(type).then((opened) => {
                  if (opened) {
                    trackEvent('legal_link_opened', undefined)
                    return
                  }
                  setFailureMessage(`Could not open ${labels[type]}. Please try again.`)
                })
              }}
              style={({ pressed }) => ({ opacity: !configured ? 0.45 : pressed ? 0.65 : 1 })}
            >
              <Text selectable={false} style={[typography.caption, { color: colors.primary, textDecorationLine: 'underline' }]}>{labels[type]}</Text>
            </Pressable>
          )
        })}
      </View>
      {failureMessage ? (
        <Text accessibilityLiveRegion="polite" selectable style={[typography.caption, { color: colors.error, textAlign: 'center' }]}>
          {failureMessage}
        </Text>
      ) : null}
    </View>
  )
}
