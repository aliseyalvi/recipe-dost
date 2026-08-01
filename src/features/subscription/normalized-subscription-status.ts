import type { SubscriptionState } from './subscription-state'

export type NormalizedSubscriptionStatus = {
  state: SubscriptionState['kind']
  plan: 'free' | 'premium'
  isPremium: boolean
  sourceOfTruth: 'backend' | 'cached_backend' | 'store_evidence' | 'loading'
  statusTitle: string
  statusSubtitle: string
  monthlyLimit: number | null
  monthlyUsed: number | null
  monthlyReserved: number | null
  monthlyRemaining: number | null
  canStartAiJob: boolean | null
  needsSync: boolean
}

export function getNormalizedSubscriptionStatus(
  state: SubscriptionState
): NormalizedSubscriptionStatus {
  const access = state.lastSuccessfulBackendAccessSnapshot
  const premiumConfirmed =
    state.kind === 'premium_confirmed' ||
    state.kind === 'refresh_failed_cached_premium'
  const quota = premiumConfirmed
    ? {
        monthlyLimit: access?.premiumMonthlyLimit ?? null,
        monthlyUsed: access?.premiumMonthlySuccessfulUsed ?? null,
        monthlyReserved: access?.premiumMonthlyActiveReserved ?? null,
        monthlyRemaining: access?.premiumMonthlyRemainingToStart ?? null,
      }
    : {
        monthlyLimit: null,
        monthlyUsed: null,
        monthlyReserved: access?.freeActiveReserved ?? null,
        monthlyRemaining: access?.freeRemainingToStart ?? null,
      }

  const copy = getStateCopy(state, quota)
  return {
    state: state.kind,
    plan: premiumConfirmed ? 'premium' : 'free',
    isPremium: premiumConfirmed,
    sourceOfTruth:
      state.kind === 'initializing'
        ? 'loading'
        : state.kind === 'refresh_failed_cached_premium'
          ? 'cached_backend'
          : state.kind === 'store_premium_backend_pending'
            ? 'store_evidence'
            : 'backend',
    statusTitle: copy.title,
    statusSubtitle: copy.subtitle,
    ...quota,
    canStartAiJob: access?.canStartAiJob ?? null,
    needsSync: state.kind === 'store_premium_backend_pending',
  }
}

export function getRecipeSubscriptionAvailabilityText(
  status: NormalizedSubscriptionStatus
) {
  return status.isPremium
    ? `Premium · ${status.statusSubtitle}`
    : status.statusSubtitle
}

function getStateCopy(
  state: SubscriptionState,
  quota: { monthlyLimit: number | null; monthlyUsed: number | null; monthlyRemaining: number | null }
) {
  switch (state.kind) {
    case 'premium_confirmed':
      return {
        title: 'Premium is active',
        subtitle: getPremiumGenerationAvailabilityText(state, quota),
      }
    case 'refresh_failed_cached_premium':
      return {
        title: 'Premium active',
        subtitle: 'Could not verify Premium access. Your last confirmed access was not changed.',
      }
    case 'store_premium_backend_pending':
      return {
        title: 'Verifying Premium access',
        subtitle: 'Purchase found. Verifying your AI access…',
      }
    case 'expired':
      return {
        title: 'Subscription expired',
        subtitle: 'Your previous subscription has expired.',
      }
    case 'restore_no_active_entitlement':
      return {
        title: 'No active subscription',
        subtitle: 'No active subscription was found for this store account.',
      }
    case 'binding_conflict':
      return {
        title: 'Premium needs support',
        subtitle: 'This purchase is linked to another app profile. Contact support for help.',
      }
    case 'refresh_failed_free':
      return {
        title: 'Free plan',
        subtitle: 'Could not verify Premium access. Your last confirmed access was not changed.',
      }
    case 'initializing':
      return { title: 'Checking subscription…', subtitle: 'Checking your AI access.' }
    case 'free':
      return { title: 'Free plan', subtitle: '3 free AI recipe cards included.' }
  }
}

export function getPremiumGenerationAvailabilityText(
  state: SubscriptionState,
  quota: {
    monthlyLimit: number | null
    monthlyUsed: number | null
    monthlyRemaining: number | null
  } = {
    monthlyLimit: state.monthlyLimit,
    monthlyUsed: state.successfulUsed,
    monthlyRemaining: state.remainingToStart,
  }
) {
  if (state.backendCanStartAiJob) {
    return getPremiumQuotaSubtitle(quota)
  }

  if (
    state.backendBlockReason === 'active_ai_job_limit_reached' ||
    state.activeReserved > 0
  ) {
    return 'An AI recipe is already being processed. Try again when it finishes.'
  }

  if (
    state.backendBlockReason === 'premium_monthly_limit_reached' ||
    (typeof state.monthlyLimit === 'number' &&
      state.successfulUsed >= state.monthlyLimit) ||
    state.remainingToStart === 0
  ) {
    const limit = state.monthlyLimit ?? quota.monthlyLimit ?? 100
    return `You have used all ${limit} AI recipes for this billing period.`
  }

  return 'AI recipe generation is temporarily unavailable.'
}

function getPremiumQuotaSubtitle({
  monthlyLimit,
  monthlyUsed,
  monthlyRemaining,
}: {
  monthlyLimit: number | null
  monthlyUsed: number | null
  monthlyRemaining: number | null
}) {
  if (typeof monthlyRemaining === 'number') {
    return `${monthlyRemaining} AI ${monthlyRemaining === 1 ? 'recipe' : 'recipes'} left this month`
  }
  if (typeof monthlyUsed === 'number' && typeof monthlyLimit === 'number') {
    return `${monthlyUsed}/${monthlyLimit} used this month`
  }
  return '100 AI recipe cards/month'
}
