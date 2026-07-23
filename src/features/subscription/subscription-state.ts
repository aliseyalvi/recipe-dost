import type { AiAccessState } from '@/lib/api/ai-access'
import type { CustomerInfo, PurchasesEntitlementInfo } from '@revenuecat/purchases-typescript-internal'

export type SubscriptionStateKind =
  | 'initializing'
  | 'free'
  | 'premium_confirmed'
  | 'store_premium_backend_pending'
  | 'expired'
  | 'restore_no_active_entitlement'
  | 'refresh_failed_cached_premium'
  | 'refresh_failed_free'
  | 'binding_conflict'

export type SubscriptionRefreshTrigger =
  | 'bootstrap'
  | 'listener'
  | 'restore'
  | 'refresh'
  | 'purchase'
  | 'generate'
  | 'foreground'

export type ExpirationRelation = 'future' | 'expired' | 'none' | 'invalid'
export type ProviderEnvironment = 'sandbox' | 'production' | 'unknown'
export type SynchronizationState =
  | 'idle'
  | 'synchronizing'
  | 'synchronized'
  | 'in_progress'
  | 'failed'

export type LocalEntitlementEvidence = {
  active: boolean
  expirationDate: string | null
  expirationRelation: ExpirationRelation
  providerEnvironment: ProviderEnvironment
}

export type SubscriptionState = {
  kind: SubscriptionStateKind
  backendPremiumActive: boolean
  backendCanStartAiJob: boolean
  backendBlockReason: AiAccessState['blockReason']
  remainingToStart: number | null
  activeReserved: number
  successfulUsed: number
  monthlyLimit: number | null
  backendPlan: 'free' | 'premium' | 'unknown'
  backendFreshness: 'fresh' | 'cached' | 'missing'
  localEntitlementActive: boolean
  localExpirationDate: string | null
  localExpirationRelation: ExpirationRelation
  providerEnvironment: ProviderEnvironment
  synchronizationState: SynchronizationState
  lastSuccessfulBackendAccessSnapshot: AiAccessState | null
  normalizedErrorCode: string | null
  refreshTrigger: SubscriptionRefreshTrigger
}

export const EMPTY_LOCAL_ENTITLEMENT: LocalEntitlementEvidence = {
  active: false,
  expirationDate: null,
  expirationRelation: 'none',
  providerEnvironment: 'unknown',
}

export function getLocalEntitlementEvidence(
  customerInfo: CustomerInfo | null,
  entitlementId: string,
  now = Date.now()
): LocalEntitlementEvidence {
  const active = customerInfo?.entitlements.active[entitlementId]
  const historical = customerInfo?.entitlements.all[entitlementId]
  const entitlement = active ?? historical ?? null

  return {
    active: Boolean(active),
    expirationDate: entitlement?.expirationDate ?? null,
    expirationRelation: getExpirationRelation(entitlement, now),
    providerEnvironment: entitlement
      ? entitlement.isSandbox
        ? 'sandbox'
        : 'production'
      : 'unknown',
  }
}

export function getEntitlementEvidenceFingerprint(
  evidence: LocalEntitlementEvidence
) {
  return [
    evidence.active ? 'active' : 'inactive',
    evidence.expirationDate ?? 'none',
    evidence.providerEnvironment,
  ].join(':')
}

export function deriveSubscriptionState({
  backendAccess,
  lastSuccessfulBackendAccess,
  localEvidence = EMPTY_LOCAL_ENTITLEMENT,
  synchronizationState = 'idle',
  errorCode = null,
  trigger = 'bootstrap',
  restoreCompleted = false,
  initializing = false,
}: {
  backendAccess?: AiAccessState | null
  lastSuccessfulBackendAccess?: AiAccessState | null
  localEvidence?: LocalEntitlementEvidence
  synchronizationState?: SynchronizationState
  errorCode?: string | null
  trigger?: SubscriptionRefreshTrigger
  restoreCompleted?: boolean
  initializing?: boolean
}): SubscriptionState {
  const hasFreshBackend = Boolean(backendAccess)
  const lastSnapshot = backendAccess ?? lastSuccessfulBackendAccess ?? null
  const backendPremiumActive = backendAccess?.premiumActive === true
  const effectivePremiumActive =
    backendPremiumActive ||
    (Boolean(errorCode) && lastSnapshot?.premiumActive === true)
  let kind: SubscriptionStateKind

  if (errorCode === 'revenuecat_binding_conflict') {
    kind = 'binding_conflict'
  } else if (lastSnapshot?.premiumActive === true && errorCode) {
    kind = 'refresh_failed_cached_premium'
  } else if (backendPremiumActive) {
    kind = 'premium_confirmed'
  } else if (localEvidence.active) {
    kind = 'store_premium_backend_pending'
  } else if (localEvidence.expirationRelation === 'expired') {
    kind = 'expired'
  } else if (restoreCompleted) {
    kind = 'restore_no_active_entitlement'
  } else if (errorCode) {
    kind = 'refresh_failed_free'
  } else if (initializing && !lastSnapshot) {
    kind = 'initializing'
  } else {
    kind = 'free'
  }

  return {
    kind,
    backendPremiumActive: effectivePremiumActive,
    backendCanStartAiJob: lastSnapshot?.canStartAiJob === true,
    backendBlockReason: lastSnapshot?.blockReason ?? null,
    remainingToStart: lastSnapshot?.remainingToStart ?? null,
    activeReserved: lastSnapshot?.activeReserved ?? 0,
    successfulUsed: lastSnapshot?.premiumActive
      ? lastSnapshot.premiumMonthlySuccessfulUsed
      : lastSnapshot?.freeSuccessfulUsed ?? 0,
    monthlyLimit: lastSnapshot?.premiumActive
      ? lastSnapshot.premiumMonthlyLimit
      : lastSnapshot?.monthlyLimit ?? null,
    backendPlan: lastSnapshot?.plan ?? 'unknown',
    backendFreshness: kind === 'refresh_failed_cached_premium'
      ? 'cached'
      : hasFreshBackend
      ? 'fresh'
      : lastSnapshot
        ? 'cached'
        : 'missing',
    localEntitlementActive: localEvidence.active,
    localExpirationDate: localEvidence.expirationDate,
    localExpirationRelation: localEvidence.expirationRelation,
    providerEnvironment: localEvidence.providerEnvironment,
    synchronizationState,
    lastSuccessfulBackendAccessSnapshot: lastSnapshot,
    normalizedErrorCode: errorCode,
    refreshTrigger: trigger,
  }
}

function getExpirationRelation(
  entitlement: PurchasesEntitlementInfo | null,
  now: number
): ExpirationRelation {
  if (!entitlement?.expirationDate) return 'none'
  const expiresAt = new Date(entitlement.expirationDate).getTime()
  if (!Number.isFinite(expiresAt)) return 'invalid'
  return expiresAt > now ? 'future' : 'expired'
}
