import { detectRecipePlatform } from '@/features/recipe-draft/platform'

const httpUrlPattern = /https?:\/\/[^\s<>"']+/gi
const trailingPunctuationPattern = /[),.!?;:\]}]+$/u

export function extractFirstRecipeUrlFromText(
  text: string | null | undefined
) {
  if (!text) {
    return null
  }

  const matches = text.matchAll(httpUrlPattern)

  for (const match of matches) {
    const candidate = match[0].trim().replace(trailingPunctuationPattern, '')

    try {
      const parsedUrl = new URL(candidate)

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        continue
      }

      const normalizedUrl = parsedUrl.toString()

      if (detectRecipePlatform(normalizedUrl) === 'other') {
        continue
      }

      return normalizedUrl
    } catch {
      continue
    }
  }

  return null
}

export function extractFirstHttpUrl(value: string | null | undefined) {
  return extractFirstRecipeUrlFromText(value)
}

export function extractFirstRecipeUrlFromSharedText(
  text: string | null | undefined
) {
  return extractFirstRecipeUrlFromText(text)
}
