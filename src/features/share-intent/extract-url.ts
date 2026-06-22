const httpUrlPattern = /https?:\/\/[^\s<>"']+/i

export function extractFirstHttpUrl(value: string | null | undefined) {
  const match = value?.match(httpUrlPattern)

  if (!match) {
    return null
  }

  const candidate = match[0].replace(/[),.]+$/, '')

  try {
    const parsedUrl = new URL(candidate)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null
    }

    return parsedUrl.toString()
  } catch {
    return null
  }
}
