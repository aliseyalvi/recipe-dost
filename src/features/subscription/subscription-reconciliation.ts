import type { AiAccessState } from '@/lib/api/ai-access'
import {
  PremiumEntitlementSyncError,
  syncPremiumEntitlement,
} from '@/lib/api/premium-entitlement'
import {
  aiAccessQueryKey,
  fetchAuthoritativeAiAccess,
} from '@/lib/query/ai-access-query'
import type { QueryClient } from '@tanstack/react-query'
import type { SubscriptionRefreshTrigger } from './subscription-state'

export type SubscriptionSyncResult = {
  ok: boolean
  syncStatus: 'synchronized' | 'in_progress' | 'failed'
  backendAccess?: AiAccessState
  errorCode?: string
}

const inFlightSyncPromises = new Map<
  string,
  Promise<SubscriptionSyncResult>
>()

export function reconcileSubscriptionAccess({
  queryClient,
  userId,
  trigger,
}: {
  queryClient: QueryClient
  userId: string
  trigger: SubscriptionRefreshTrigger
}) {
  const existing = inFlightSyncPromises.get(userId)
  if (existing) return existing

  const reconciliation = (async (): Promise<SubscriptionSyncResult> => {
    try {
      const synced = await syncPremiumEntitlement({ trigger })
      await queryClient.cancelQueries({
        queryKey: aiAccessQueryKey(userId),
        exact: true,
      })
      const backendAccess = await fetchAuthoritativeAiAccess(
        queryClient,
        userId,
        true
      )
      return {
        ok: true,
        syncStatus:
          synced.sync_status === 'in_progress'
            ? 'in_progress'
            : 'synchronized',
        backendAccess,
      }
    } catch (error) {
      let backendAccess: AiAccessState | undefined
      try {
        await queryClient.cancelQueries({
          queryKey: aiAccessQueryKey(userId),
          exact: true,
        })
        backendAccess = await fetchAuthoritativeAiAccess(
          queryClient,
          userId,
          true
        )
      } catch {
        // Keep the last successful user-scoped query snapshot unchanged.
      }
      return {
        ok: false,
        syncStatus: 'failed',
        backendAccess,
        errorCode:
          error instanceof PremiumEntitlementSyncError
            ? error.code
            : 'subscription_sync_failed',
      }
    }
  })()

  inFlightSyncPromises.set(userId, reconciliation)
  void reconciliation.finally(() => {
    if (inFlightSyncPromises.get(userId) === reconciliation) {
      inFlightSyncPromises.delete(userId)
    }
  })
  return reconciliation
}

export function clearSubscriptionReconciliationForTests() {
  inFlightSyncPromises.clear()
}
