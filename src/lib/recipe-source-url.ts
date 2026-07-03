const TRACKING_PARAMS = new Set([
  'si',
  'igsh',
  'fbclid',
  'gclid',
  'ref',
  'share_id',
])

export function normalizeRecipeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    const host = normalizeHost(url.hostname)
    const pathParts = getPathParts(url)

    if (host === 'youtu.be') {
      return pathParts[0] ? `youtube:${pathParts[0]}` : null
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (pathParts[0] === 'shorts' && pathParts[1]) {
        return `youtube:${pathParts[1]}`
      }

      const videoId = cleanSegment(url.searchParams.get('v'))
      return videoId ? `youtube:${videoId}` : canonicalUrlKey(url, host)
    }

    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      if ((pathParts[0] === 'reel' || pathParts[0] === 'p') && pathParts[1]) {
        return `instagram:${pathParts[0]}:${pathParts[1]}`
      }

      return canonicalUrlKey(url, host)
    }

    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      const videoIndex = pathParts.indexOf('video')

      if (videoIndex >= 0 && pathParts[videoIndex + 1]) {
        return `tiktok:${pathParts[videoIndex + 1]}`
      }

      return canonicalUrlKey(url, host)
    }

    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
      return canonicalUrlKey(url, host)
    }

    if (host === 'fb.watch') {
      return pathParts[0] ? `facebook:watch:${pathParts[0]}` : null
    }

    if (host === 'facebook.com' || host.endsWith('.facebook.com')) {
      const videoId =
        getQueryParam(url, 'v') ??
        getPathIdAfter(pathParts, 'videos') ??
        getPathIdAfter(pathParts, 'watch')

      return videoId ? `facebook:${videoId}` : canonicalUrlKey(url, host)
    }

    return canonicalUrlKey(url, host)
  } catch {
    return null
  }
}

function canonicalUrlKey(url: URL, host: string) {
  const params = new URLSearchParams(url.searchParams)

  for (const key of Array.from(params.keys())) {
    if (isTrackingParam(key)) {
      params.delete(key)
    }
  }

  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  const query = params.toString()

  return `${host}${pathname}${query ? `?${query}` : ''}`
}

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function getPathParts(url: URL) {
  return url.pathname
    .split('/')
    .map((part) => cleanSegment(part))
    .filter((part): part is string => Boolean(part))
}

function getQueryParam(url: URL, key: string) {
  return cleanSegment(url.searchParams.get(key))
}

function getPathIdAfter(parts: string[], marker: string) {
  const index = parts.indexOf(marker)

  return index >= 0 ? parts[index + 1] : null
}

function cleanSegment(value: string | null | undefined) {
  return value?.trim() || null
}

function isTrackingParam(key: string) {
  const normalizedKey = key.toLowerCase()

  return TRACKING_PARAMS.has(normalizedKey) || normalizedKey.startsWith('utm_')
}
