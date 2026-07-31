import type { QueryClient } from '@tanstack/react-query'

export const USER_OWNED_QUERY_ROOTS = [
  ['recent-recipes'],
  ['recipe-library'],
  ['favourites'],
  ['recipe-item'],
  ['recipe-card'],
  ['recipe-grocery-list'],
  ['recipe-grocery-lists'],
  ['active-media-jobs'],
  ['media-job'],
  ['ai-access-state'],
  ['usage-summary'],
  ['user-profile'],
] as const

export function clearUserOwnedQueries(queryClient: QueryClient) {
  for (const queryKey of USER_OWNED_QUERY_ROOTS) {
    queryClient.removeQueries({ queryKey })
  }
}

export async function refreshUserOwnedQueries(queryClient: QueryClient) {
  await Promise.all(
    USER_OWNED_QUERY_ROOTS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
    )
  )
}
