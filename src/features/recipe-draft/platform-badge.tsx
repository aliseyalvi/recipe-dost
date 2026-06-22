import { getPlatformLabel } from '@/features/recipe-draft/platform'
import { RecipePlatform } from '@/features/recipe-draft/types'
import { AppBadge } from '@/ui/app-badge'

type Props = {
  platform: RecipePlatform
}

export function PlatformBadge({ platform }: Props) {
  return <AppBadge label={getPlatformLabel(platform)} tone="primary" />
}
