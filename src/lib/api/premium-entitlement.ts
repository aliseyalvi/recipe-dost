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

export async function syncPremiumEntitlement() {
  const { data, error } =
    await supabase.functions.invoke<SyncPremiumEntitlementResponse>(
      'sync-revenuecat-entitlement',
      { method: 'POST' }
    )

  if (error) {
    throw error
  }

  if (!data?.ok) {
    throw new Error(data?.error.message ?? 'Could not sync Premium access.')
  }

  return data.data
}
