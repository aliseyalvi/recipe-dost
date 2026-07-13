import type { MediaJob } from '@/lib/api/recipes'
import { isMediaJobActive } from '@/lib/api/recipes'

export type RecipeDetailViewState =
  | 'metadata_loading'
  | 'metadata_ready'
  | 'ai_processing'
  | 'ai_ready'
  | 'failed'

export function getRecipeDetailViewState({
  metadataStatus,
  mediaJob,
  hasRecipeCard,
}: {
  metadataStatus: string | null | undefined
  mediaJob: MediaJob | null | undefined
  hasRecipeCard: boolean
}): RecipeDetailViewState {
  if (hasRecipeCard || mediaJob?.result_recipe_card_id) {
    return 'ai_ready'
  }

  if (isMediaJobActive(mediaJob)) {
    return 'ai_processing'
  }

  if (
    mediaJob?.status === 'failed' ||
    mediaJob?.status === 'cancelled' ||
    mediaJob?.status === 'needs_caption'
  ) {
    return 'failed'
  }

  if (
    metadataStatus === 'saving' ||
    metadataStatus === 'pending' ||
    metadataStatus === 'refreshing'
  ) {
    return 'metadata_loading'
  }

  if (metadataStatus === 'failed') {
    return 'failed'
  }

  return 'metadata_ready'
}
