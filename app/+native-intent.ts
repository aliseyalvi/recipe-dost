import { extractFirstHttpUrl } from '@/features/share-intent/extract-url'

const appRoutes = new Set([
  '',
  '/',
  'home',
  '/home',
  'library',
  '/library',
  'grocery',
  '/grocery',
  'settings',
  '/settings',
  'save-recipe',
  '/save-recipe',
  'welcome',
  '/welcome',
  'onboarding',
  '/onboarding',
])

export function redirectSystemPath({
  path,
}: {
  path: string
  initial: boolean
}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (appRoutes.has(path)) {
    return normalizedPath
  }

  if (
    normalizedPath.startsWith('/recipe/') ||
    normalizedPath.startsWith('/recipe-card/') ||
    normalizedPath.startsWith('/paywall')
  ) {
    return normalizedPath
  }

  const sharedUrl = extractFirstHttpUrl(decodeURIComponent(path))

  if (sharedUrl) {
    return `/share-recipe?url=${encodeURIComponent(sharedUrl)}`
  }

  return `/share-recipe?text=${encodeURIComponent(path)}`
}
