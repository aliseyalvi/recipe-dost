import { RecipePlatform } from '@/features/recipe-draft/types'

export function detectRecipePlatform(sourceUrl: string): RecipePlatform {
  const parsedUrl = parseHttpUrl(sourceUrl)

  if (!parsedUrl) {
    return 'other'
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, '')

  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    return 'instagram'
  }

  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) {
    return 'tiktok'
  }

  if (
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtu.be'
  ) {
    return 'youtube'
  }

  if (
    hostname === 'facebook.com' ||
    hostname.endsWith('.facebook.com') ||
    hostname === 'fb.watch'
  ) {
    return 'facebook'
  }

  return 'other'
}

export function isValidHttpUrl(sourceUrl: string | null | undefined) {
  return Boolean(parseHttpUrl(sourceUrl))
}

function parseHttpUrl(sourceUrl: string | null | undefined) {
  const trimmedSourceUrl = sourceUrl?.trim()

  if (!trimmedSourceUrl) {
    return null
  }

  try {
    const parsedUrl = new URL(trimmedSourceUrl)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null
    }

    return parsedUrl
  } catch {
    return null
  }
}

export function getPlatformLabel(platform: RecipePlatform) {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'facebook':
      return 'Facebook'
    case 'other':
      return 'Other'
  }
}

export function getReadableSource(sourceUrl: string) {
  const url = parseHttpUrl(sourceUrl)

  if (!url) {
    return 'Invalid recipe link'
  }

  const pathname = url.pathname === '/' ? '' : url.pathname
  const shortenedPath =
    pathname.length > 28 ? `${pathname.slice(0, 28)}...` : pathname

  return `${url.hostname.replace(/^www\./, '')}${shortenedPath}`
}
