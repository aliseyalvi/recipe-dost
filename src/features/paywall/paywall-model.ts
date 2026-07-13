import type { AiAccessState } from '@/lib/api/ai-access'
import {
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal'

export const PAYWALL_MONTHLY_PRODUCT_ID = 'recipe_dost_premium_monthly'
export const PAYWALL_YEARLY_PRODUCT_ID = 'recipe_dost_premium_yearly'

export type PaywallPlan = 'monthly' | 'yearly'

export type PaywallTrigger =
  | 'home_usage_pill'
  | 'library_usage_pill'
  | 'grocery_usage_pill'
  | 'settings_upgrade'
  | 'recipe_usage_pill'
  | 'free_limit_reached'
  | 'generation_access_blocked'
  | 'post_result_upgrade'
  | 'unknown'

export type PaywallPackageMap = {
  monthly: PurchasesPackage | null
  yearly: PurchasesPackage | null
}

export type PaywallUsage = {
  title: string
  summary: string
  remainingText: string
  reservedText: string | null
  accessibilityLabel: string
  limit: number
  used: number
  remaining: number
  progress: number
}

export type PaywallPurchaseErrorKind =
  | 'cancelled'
  | 'pending'
  | 'product_unavailable'
  | 'already_subscribed'
  | 'failed'

const allowedTriggers = new Set<PaywallTrigger>([
  'home_usage_pill',
  'library_usage_pill',
  'grocery_usage_pill',
  'settings_upgrade',
  'recipe_usage_pill',
  'free_limit_reached',
  'generation_access_blocked',
  'post_result_upgrade',
  'unknown',
])

export function getPaywallHref(trigger: PaywallTrigger) {
  return {
    pathname: '/paywall',
    params: { trigger },
  } as const
}

export function normalizePaywallTrigger(
  value: string | string[] | undefined
): PaywallTrigger {
  const trigger = Array.isArray(value) ? value[0] : value

  return trigger && allowedTriggers.has(trigger as PaywallTrigger)
    ? (trigger as PaywallTrigger)
    : 'unknown'
}

export function mapPaywallPackages(
  packages: PurchasesPackage[]
): PaywallPackageMap {
  const monthly =
    packages.find((item) =>
      matchesProductIdentifier(item, PAYWALL_MONTHLY_PRODUCT_ID)
    ) ?? null
  const yearlyCandidate =
    packages.find((item) =>
      matchesProductIdentifier(item, PAYWALL_YEARLY_PRODUCT_ID)
    ) ?? null
  const yearly =
    yearlyCandidate?.identifier === monthly?.identifier ? null : yearlyCandidate

  return { monthly, yearly }
}

export function getPackagePlan(
  selectedPackage: PurchasesPackage,
  packageMap: PaywallPackageMap
): PaywallPlan {
  if (packageMap.yearly?.identifier === selectedPackage.identifier) {
    return 'yearly'
  }

  if (packageMap.monthly?.identifier === selectedPackage.identifier) {
    return 'monthly'
  }

  return selectedPackage.packageType === PACKAGE_TYPE.ANNUAL ||
    includesCadence(selectedPackage, ['annual', 'year'])
    ? 'yearly'
    : 'monthly'
}

export function getPackagePlanLabel(plan: PaywallPlan) {
  return plan === 'yearly' ? 'Yearly' : 'Monthly'
}

export function getPackagePriceSummary(
  selectedPackage: PurchasesPackage,
  plan: PaywallPlan
) {
  return `${selectedPackage.product.priceString}/${
    plan === 'yearly' ? 'year' : 'month'
  }`
}

export function getIntroOfferText(selectedPackage: PurchasesPackage) {
  const introPrice = selectedPackage.product.introPrice

  if (!introPrice) {
    return null
  }

  const duration = formatIntroDuration({
    cycles: introPrice.cycles,
    units: introPrice.periodNumberOfUnits,
    unit: introPrice.periodUnit,
  })

  if (introPrice.price === 0) {
    return `Google Play free introductory offer: ${duration}`
  }

  return `Google Play introductory offer: ${introPrice.priceString} for ${duration}`
}

export function hasIntroOffer(selectedPackage: PurchasesPackage) {
  return Boolean(selectedPackage.product.introPrice)
}

export function getPaywallUsage(
  access: AiAccessState,
  isPremium: boolean
): PaywallUsage {
  const rawLimit = isPremium
    ? access.premiumMonthlyLimit
    : access.freeLimit
  const limit = toNonNegativeInteger(rawLimit)
  const rawUsed = isPremium
    ? access.premiumMonthlySuccessfulUsed
    : access.freeSuccessfulUsed
  const rawRemaining = isPremium
    ? access.premiumMonthlyRemainingToStart
    : access.freeRemainingToStart
  const rawReserved = isPremium
    ? access.premiumMonthlyActiveReserved
    : access.freeActiveReserved
  const used = clamp(toNonNegativeInteger(rawUsed), 0, limit)
  const remaining = clamp(toNonNegativeInteger(rawRemaining), 0, limit)
  const reserved = toNonNegativeInteger(rawReserved)
  const title = isPremium ? 'Monthly AI Recipe Usage' : 'AI Recipe Usage'
  const summary = `${used} of ${limit} used`
  const remainingText = `${remaining} AI ${
    remaining === 1 ? 'recipe' : 'recipes'
  } left${isPremium ? ' this month' : ''}`
  const reservedText = reserved > 0
    ? `${reserved} ${reserved === 1 ? 'recipe is' : 'recipes are'} currently processing`
    : null

  return {
    title,
    summary,
    remainingText,
    reservedText,
    accessibilityLabel: `${title}. ${summary}. ${remainingText}.`,
    limit,
    used,
    remaining,
    progress: limit > 0 ? clamp(used / limit, 0, 1) : 0,
  }
}

export function getPaywallPurchaseErrorKind(
  error: unknown
): PaywallPurchaseErrorKind {
  if (!error || typeof error !== 'object') {
    return 'failed'
  }

  const record = error as {
    code?: unknown
    userCancelled?: unknown
  }
  const code = typeof record.code === 'string' ? record.code : null

  if (
    code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    record.userCancelled === true
  ) {
    return 'cancelled'
  }

  if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return 'pending'
  }

  if (code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) {
    return 'product_unavailable'
  }

  if (code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
    return 'already_subscribed'
  }

  return 'failed'
}

function matchesProductIdentifier(
  selectedPackage: PurchasesPackage,
  productId: string
) {
  const identifier = selectedPackage.product.identifier

  return identifier === productId || identifier.startsWith(`${productId}:`)
}

function includesCadence(
  selectedPackage: PurchasesPackage,
  values: string[]
) {
  const searchable = `${selectedPackage.identifier} ${selectedPackage.product.identifier}`.toLowerCase()

  return values.some((value) => searchable.includes(value))
}

function formatIntroDuration({
  cycles,
  units,
  unit,
}: {
  cycles: number
  units: number
  unit: string
}) {
  const totalUnits = Math.max(1, cycles) * Math.max(1, units)
  const normalizedUnit = unit.trim().toLowerCase()
  const label = normalizedUnit || 'billing period'

  return `${totalUnits} ${label}${totalUnits === 1 ? '' : 's'}`
}

function toNonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}
