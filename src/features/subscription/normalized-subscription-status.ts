import type { AiAccessState } from '@/lib/api/ai-access'

export type NormalizedSubscriptionStatus = {
  plan: 'free' | 'premium'
  isPremium: boolean
  sourceOfTruth: 'backend' | 'revenuecat_local' | 'loading'
  statusTitle: string
  statusSubtitle: string
  monthlyLimit: number | null
  monthlyUsed: number | null
  monthlyReserved: number | null
  monthlyRemaining: number | null
  canStartAiJob: boolean | null
  needsSync: boolean
}

type RevenueCatState = {
  isPremium: boolean
  isLoading?: boolean
}

type Params = {
  aiAccess?: AiAccessState | null
  previousAiAccess?: AiAccessState | null
  isAiAccessLoading?: boolean
  revenueCatState: RevenueCatState
}

export function getNormalizedSubscriptionStatus({
  aiAccess,
  previousAiAccess,
  isAiAccessLoading = false,
  revenueCatState,
}: Params): NormalizedSubscriptionStatus {
  const effectiveAiAccess = aiAccess ?? (isAiAccessLoading ? previousAiAccess : null)
  const localPremiumActive = revenueCatState.isPremium
  const backendPremiumActive =
    effectiveAiAccess?.plan === 'premium' ||
    effectiveAiAccess?.premiumActive === true ||
    getBooleanField(effectiveAiAccess, 'premium_active') === true

  if (backendPremiumActive) {
    const monthlyLimit = effectiveAiAccess?.premiumMonthlyLimit ?? null
    const monthlyUsed = effectiveAiAccess?.premiumMonthlySuccessfulUsed ?? null
    const monthlyReserved = effectiveAiAccess?.premiumMonthlyActiveReserved ?? null
    const monthlyRemaining =
      effectiveAiAccess?.premiumMonthlyRemainingToStart ?? null

    return {
      plan: 'premium',
      isPremium: true,
      sourceOfTruth: aiAccess ? 'backend' : 'loading',
      statusTitle: aiAccess ? 'Premium active' : 'Checking Premium access...',
      statusSubtitle: getPremiumQuotaSubtitle({
        monthlyLimit,
        monthlyUsed,
        monthlyRemaining,
      }),
      monthlyLimit,
      monthlyUsed,
      monthlyReserved,
      monthlyRemaining,
      canStartAiJob: effectiveAiAccess?.canStartAiJob ?? null,
      needsSync: false,
    }
  }

  if (aiAccess && localPremiumActive) {
    return {
      plan: 'premium',
      isPremium: true,
      sourceOfTruth: 'revenuecat_local',
      statusTitle: 'Syncing Premium access...',
      statusSubtitle: 'Your purchase is active. We are updating your AI access.',
      monthlyLimit: null,
      monthlyUsed: null,
      monthlyReserved: null,
      monthlyRemaining: null,
      canStartAiJob: aiAccess.canStartAiJob,
      needsSync: true,
    }
  }

  if (isAiAccessLoading || revenueCatState.isLoading) {
    return {
      plan: localPremiumActive ? 'premium' : 'free',
      isPremium: localPremiumActive,
      sourceOfTruth: 'loading',
      statusTitle: localPremiumActive
        ? 'Checking Premium access...'
        : 'Checking subscription...',
      statusSubtitle: localPremiumActive
        ? 'Your purchase is active. Checking AI access.'
        : 'Checking your AI access.',
      monthlyLimit: null,
      monthlyUsed: null,
      monthlyReserved: null,
      monthlyRemaining: null,
      canStartAiJob: null,
      needsSync: false,
    }
  }

  return {
    plan: 'free',
    isPremium: false,
    sourceOfTruth: aiAccess ? 'backend' : 'revenuecat_local',
    statusTitle: 'Free plan',
    statusSubtitle: '3 free AI recipe cards included.',
    monthlyLimit: null,
    monthlyUsed: null,
    monthlyReserved: aiAccess?.freeActiveReserved ?? null,
    monthlyRemaining: aiAccess?.freeRemainingToStart ?? null,
    canStartAiJob: aiAccess?.canStartAiJob ?? null,
    needsSync: false,
  }
}

export function getRecipeSubscriptionAvailabilityText(
  status: NormalizedSubscriptionStatus
) {
  if (status.needsSync || status.sourceOfTruth === 'loading') {
    return status.statusSubtitle
  }

  if (!status.isPremium) {
    return status.statusSubtitle
  }

  return `Premium · ${status.statusSubtitle}`
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
    return `${monthlyRemaining} AI ${
      monthlyRemaining === 1 ? 'recipe' : 'recipes'
    } left this month`
  }

  if (typeof monthlyUsed === 'number' && typeof monthlyLimit === 'number') {
    return `${monthlyUsed}/${monthlyLimit} used this month`
  }

  return '100 AI recipe cards/month'
}

function getBooleanField(
  value: AiAccessState | null | undefined,
  key: string
) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>

  return typeof record[key] === 'boolean' ? record[key] : null
}
