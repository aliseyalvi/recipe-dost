import type { RecipeLibraryItem } from '@/lib/api/recipes'

const CARD_TITLE_MAX_LENGTH = 58
const CREATOR_MAX_LENGTH = 40

export function getRecipeDisplayTitle(recipe: RecipeLibraryItem) {
  const aiTitle = cleanSingleLine(recipe.latest_card?.recipe_title)

  if (aiTitle) {
    return aiTitle
  }

  const creator = getRecipeCreatorValue(recipe)
  const metadata = getMetadataRecord(recipe.source_metadata)
  const metadataTitles = [
    recipe.latest_media_job?.source_metadata.title,
    getMetadataString(metadata, 'title', 'video_title', 'videoTitle', 'og_title', 'ogTitle'),
  ]

  for (const title of metadataTitles) {
    const candidate = cleanSingleLine(title)
    if (isMeaningfulTitle(candidate, creator, recipe.platform)) {
      return candidate!
    }
  }

  const captionCandidates = [
    recipe.latest_media_job?.source_metadata.description,
    getMetadataString(metadata, 'caption', 'description', 'summary'),
    recipe.description,
    recipe.pasted_caption,
  ]

  for (const caption of captionCandidates) {
    const candidate = getCaptionDisplayTitle(caption)
    if (isMeaningfulTitle(candidate, creator, recipe.platform)) {
      return candidate!
    }
  }

  const itemTitle = cleanSingleLine(recipe.title)
  if (isMeaningfulTitle(itemTitle, creator, recipe.platform)) {
    return itemTitle!
  }

  return getPlatformRecipeFallback(recipe.platform)
}

export function getRecipeCreatorLabel(recipe: RecipeLibraryItem) {
  const creator = getRecipeCreatorValue(recipe)

  if (!creator) {
    return getPlatformLabel(recipe.platform)
  }

  const withoutPrefix = creator.replace(/^@+/, '').trim()
  const isHandle = /^[a-z0-9._-]+$/i.test(withoutPrefix)

  if (
    isHandle &&
    (recipe.platform === 'instagram' || recipe.platform === 'tiktok')
  ) {
    return `@${withoutPrefix}`
  }

  return truncateAtWord(withoutPrefix, CREATOR_MAX_LENGTH)
}

function getRecipeCreatorValue(recipe: RecipeLibraryItem) {
  const metadata = getMetadataRecord(recipe.source_metadata)
  const candidate = cleanSingleLine(
    recipe.latest_media_job?.source_metadata.author_username ??
      getMetadataString(
        metadata,
        'author_name',
        'author_username',
        'authorUsername',
        'author',
        'creator',
        'channel_name',
        'channel',
        'uploader',
        'username',
        'handle',
        'ownerUsername'
      )
  )

  if (!candidate || isRawUrl(candidate)) {
    return null
  }

  return truncateAtWord(candidate, CREATOR_MAX_LENGTH)
}

function getCaptionDisplayTitle(value: string | null | undefined) {
  if (!value?.trim()) {
    return null
  }

  const lines = value.split(/\r?\n/)

  for (const line of lines) {
    const candidate = line
      .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
      .replace(/(^|\s)@[a-z0-9._-]+/gi, ' ')
      .replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, ' ')
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ')
      .replace(
        /\b(?:full\s+recipe|ingredients?|method|directions?)\s+(?:below|in\s+(?:the\s+)?caption|in\s+(?:the\s+)?comments?).*$/i,
        ''
      )
      .split(/[.!?](?:\s|$)/, 1)[0]
      ?.replace(/\s+/g, ' ')
      .replace(/^[\s\-–—:;,."'“”‘’]+|[\s\-–—:;,."'“”‘’]+$/g, '')
      .trim()

    if (candidate && candidate.length > 2) {
      return truncateAtWord(candidate, CARD_TITLE_MAX_LENGTH)
    }
  }

  return null
}

function isMeaningfulTitle(
  value: string | null,
  creator: string | null,
  platform: string | null
) {
  if (!value || isRawUrl(value) || /^(video|post)\s+by\s+/i.test(value)) {
    return false
  }

  const normalizedTitle = normalizeComparison(value)
  if (!normalizedTitle) {
    return false
  }

  const genericValues = new Set([
    'video',
    'post',
    'recipe',
    'savedlink',
    'savedrecipe',
    normalizeComparison(getPlatformLabel(platform)),
  ])

  if (genericValues.has(normalizedTitle)) {
    return false
  }

  if (creator) {
    const normalizedCreator = normalizeComparison(creator)
    const titleWithoutGenericPrefix = normalizedTitle.replace(
      /^(video|post|reel|recipe)(by)?/,
      ''
    )

    if (
      normalizedCreator &&
      (normalizedTitle === normalizedCreator ||
        titleWithoutGenericPrefix === normalizedCreator)
    ) {
      return false
    }
  }

  return true
}

function cleanSingleLine(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const candidate = value.replace(/\s+/g, ' ').trim()
  return candidate ? truncateAtWord(candidate, CARD_TITLE_MAX_LENGTH) : null
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  const shortened = value.slice(0, maxLength + 1)
  const lastSpace = shortened.lastIndexOf(' ')
  const boundary = lastSpace >= Math.floor(maxLength * 0.65) ? lastSpace : maxLength

  return `${value.slice(0, boundary).trimEnd()}…`
}

function getMetadataRecord(value: RecipeLibraryItem['source_metadata']) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getMetadataString(
  metadata: Record<string, unknown> | null,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function normalizeComparison(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/^@+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function isRawUrl(value: string) {
  return /^(?:https?:\/\/|www\.)\S+$/i.test(value.trim())
}

function getPlatformRecipeFallback(platform: string | null) {
  switch (platform) {
    case 'instagram':
      return 'Instagram recipe link'
    case 'tiktok':
      return 'TikTok recipe link'
    case 'youtube':
      return 'YouTube recipe link'
    default:
      return 'Recipe link'
  }
}

function getPlatformLabel(platform: string | null) {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'facebook':
      return 'Facebook'
    default:
      return 'Recipe source'
  }
}
