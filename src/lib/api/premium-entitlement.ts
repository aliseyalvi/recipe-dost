import { supabase } from '@/lib/supabase/client'

export type SyncedPremiumEntitlement = {
  revenuecat_entitlement_active: boolean
  revenuecat_entitlement: string | null
  revenuecat_product_id: string | null
  revenuecat_expires_at: string | null
  revenuecat_updated_at: string | null
  sync_status?: 'synchronized' | 'in_progress'
  entitlement_source?: 'revenuecat_api' | 'cached_projection'
  freshness?: 'fresh' | 'cached'
  sync_result_code?: string
}

type SyncPremiumEntitlementResponse =
  | {
      ok: true
      data: SyncedPremiumEntitlement
    }
  | {
      ok: false
      error: {
        code: string
        message: string
      }
    }

export class PremiumEntitlementSyncError extends Error {
  constructor(
    public readonly code: string,
    message = 'Could not sync Premium access.'
  ) {
    super(message)
    this.name = 'PremiumEntitlementSyncError'
  }
}

export async function syncPremiumEntitlement({
  trigger,
  timeoutMs = 20_000,
}: {
  trigger?: string
  timeoutMs?: number
} = {}) {
  const invocation = supabase.functions.invoke<SyncPremiumEntitlementResponse>(
    'sync-revenuecat-entitlement',
    {
      method: 'POST',
      ...(trigger ? { body: { trigger } } : {}),
      timeout: timeoutMs,
    }
  )
  const { data, error } = await invocation

  if (error) {
    throw new PremiumEntitlementSyncError(
      await getSyncErrorCode(error)
    )
  }

  if (!data?.ok) {
    throw new PremiumEntitlementSyncError(
      data?.error.code ?? 'subscription_sync_failed',
      data?.error.message
    )
  }

  return data.data
}

async function getSyncErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return 'subscription_sync_failed'
  const context = (error as { context?: unknown }).context
  if (
    context &&
    typeof context === 'object' &&
    (context as { name?: unknown }).name === 'AbortError'
  ) {
    return 'timeout'
  }
  if (typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const payload = await context.clone().json() as {
        ok?: unknown
        error?: { code?: unknown }
      }
      if (
        payload.ok === false &&
        typeof payload.error?.code === 'string' &&
        /^[a-z0-9_]{1,80}$/.test(payload.error.code)
      ) {
        return payload.error.code
      }
    } catch {
      // Keep provider payloads out of client errors and telemetry.
    }
  }
  return 'subscription_sync_failed'
}
