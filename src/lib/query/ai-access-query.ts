import { getAiAccessState } from '@/lib/api/ai-access'
import { useQuery, type QueryClient } from '@tanstack/react-query'

export const AI_ACCESS_STALE_TIME_MS = 60_000
export const AI_ACCESS_QUERY_ROOT = ['ai-access-state'] as const

export function aiAccessQueryKey(userId: string | null | undefined) {
  return [...AI_ACCESS_QUERY_ROOT, userId ?? 'signed-out'] as const
}

export function useAiAccessQuery(userId: string | null | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: aiAccessQueryKey(userId),
    queryFn: getAiAccessState,
    staleTime: AI_ACCESS_STALE_TIME_MS,
  })
}

export function clearAiAccessForUser(
  queryClient: QueryClient,
  userId: string | null | undefined
) {
  if (!userId) {
    return
  }

  queryClient.removeQueries({
    queryKey: aiAccessQueryKey(userId),
    exact: true,
  })
}

export function fetchAuthoritativeAiAccess(
  queryClient: QueryClient,
  userId: string,
  force = true
) {
  return queryClient.fetchQuery({
    queryKey: aiAccessQueryKey(userId),
    queryFn: getAiAccessState,
    staleTime: force ? 0 : AI_ACCESS_STALE_TIME_MS,
  })
}

export function isAiAccessCacheStale(queryClient: QueryClient, userId: string) {
  const updatedAt =
    queryClient.getQueryState(aiAccessQueryKey(userId))?.dataUpdatedAt ?? 0
  return Date.now() - updatedAt >= AI_ACCESS_STALE_TIME_MS
}
