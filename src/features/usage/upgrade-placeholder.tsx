import { usePostHog } from '@/providers/posthog-placeholder-provider'
import { EmptyState } from '@/ui/empty-state'
import { useEffect } from 'react'

type Props = {
  limitType: 'saved_links' | 'recipe_cards' | 'grocery_lists'
  used: number
  limit: number
  actionLabel?: string
  onActionPress?: () => void
}

export function UpgradePlaceholder({
  limitType,
  used,
  limit,
  actionLabel = 'Back to Home',
  onActionPress,
}: Props) {
  const { track } = usePostHog()

  useEffect(() => {
    track('upgrade_placeholder_viewed', {
      limit_type: limitType,
      used,
      limit,
    })
  }, [limit, limitType, track, used])

  return (
    <EmptyState
      title="Upgrade coming next"
      message="Recipe Dost Premium will unlock a higher monthly AI recipe limit."
      actionLabel={actionLabel}
      onActionPress={onActionPress}
    />
  )
}
