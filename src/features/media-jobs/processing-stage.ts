import type { MediaJobStatus } from '@/lib/api/recipes'

export type ProcessingStage = {
  label: string
  title: string
  detail: string
}

export function getMetadataProcessingStage(
  status: string | null | undefined
): ProcessingStage {
  if (status === 'saving') {
    return {
      label: 'Saving link',
      title: 'Saving link',
      detail: 'Your saved recipe link is being added to Library.',
    }
  }

  return {
    label: 'Preparing preview',
    title: 'Preparing preview',
    detail: 'We are fetching the title, thumbnail, and available recipe details.',
  }
}

export function getMediaJobProcessingStage(
  status: MediaJobStatus | null | undefined
): ProcessingStage {
  switch (status) {
    case 'queued':
    case 'pending':
      return {
        label: 'Import started',
        title: 'Saving link',
        detail: 'Your AI recipe request is queued and ready to begin.',
      }
    case 'resolving':
    case 'downloading':
    case 'validating':
      return {
        label: 'Preparing preview',
        title: 'Preparing preview',
        detail: 'We are preparing the available video details for the recipe card.',
      }
    case 'thumbnailing':
    case 'processing':
    case 'running':
      return {
        label: 'Watching video',
        title: 'Watching video',
        detail: 'We are reviewing the available video details before extracting the recipe.',
      }
    case 'uploading_to_ai':
    case 'analyzing':
      return {
        label: 'Extracting recipe',
        title: 'Extracting recipe',
        detail: 'We are turning the available cooking details into a structured recipe.',
      }
    case 'saving_result':
      return {
        label: 'Creating recipe card',
        title: 'Creating recipe card',
        detail: 'Your finished recipe is being saved to Library.',
      }
    case 'completed':
      return {
        label: 'Ready',
        title: 'Recipe card ready',
        detail: 'Your AI recipe card is ready in Library.',
      }
    case 'failed':
    case 'cancelled':
    case 'needs_caption':
      return {
        label: 'Failed',
        title: 'Recipe card unavailable',
        detail: 'This recipe card needs attention before it can be created.',
      }
    default:
      return {
        label: 'Import started',
        title: 'Saving link',
        detail: 'Your AI recipe request is being prepared.',
      }
  }
}
