import type { AiAccessState } from '@/lib/api/ai-access'

type QueryPresentationState = {
  isPending: boolean
  isFetching: boolean
  hasError: boolean
}

export type AiAccessQuotaPresentation = {
  plan: 'free' | 'premium' | 'unknown'
  label: string | null
  allowanceText: string
  statusText: string | null
  isInitialLoading: boolean
  isRefreshing: boolean
  hasRefreshWarning: boolean
}

const ACCESS_REASONS = [
  'free_credit_available',
  'premium_active',
  'admin_override',
  'tester_override',
  'limit_reached',
] as const

const BLOCK_REASONS = [
  'free_ai_limit_reached',
  'premium_monthly_limit_reached',
  'active_ai_job_limit_reached',
] as const

export function normalizeAiAccessState(data: unknown): AiAccessState {
  if (!isRecord(data)) {
    throw new Error('AI access response was incomplete.')
  }

  const allowed = requireBoolean(data, 'allowed')
  const reason = requireEnum(data.reason, ACCESS_REASONS, 'reason')
  const plan = requireEnum(data.plan, ['free', 'premium'] as const, 'plan')
  const blockReason = requireNullableEnum(
    readValue(data, 'blockReason', 'block_reason'),
    BLOCK_REASONS,
    'blockReason'
  )
  const role = requireString(data.role, 'role')
  const freeLimit = requireNumber(readValue(data, 'freeLimit', 'free_limit'), 'freeLimit')
  const usedSuccessfulGenerations = requireNumber(
    readValue(
      data,
      'usedSuccessfulGenerations',
      'used_successful_generations',
      'successful_used'
    ),
    'usedSuccessfulGenerations'
  )
  const activeReserved = requireNumber(
    readValue(data, 'activeReserved', 'active_reserved'),
    'activeReserved'
  )
  const freeSuccessfulUsed = requireNumber(
    readValue(data, 'freeSuccessfulUsed', 'free_successful_used'),
    'freeSuccessfulUsed'
  )
  const freeActiveReserved = requireNumber(
    readValue(data, 'freeActiveReserved', 'free_active_reserved'),
    'freeActiveReserved'
  )
  const freeRemainingToStart = requireNumber(
    readValue(data, 'freeRemainingToStart', 'free_remaining_to_start'),
    'freeRemainingToStart'
  )
  const premiumMonthlyLimit = requireNumber(
    readValue(data, 'premiumMonthlyLimit', 'premium_monthly_limit'),
    'premiumMonthlyLimit'
  )
  const premiumMonthlySuccessfulUsed = requireNumber(
    readValue(
      data,
      'premiumMonthlySuccessfulUsed',
      'premium_monthly_successful_used'
    ),
    'premiumMonthlySuccessfulUsed'
  )
  const premiumMonthlyActiveReserved = requireNumber(
    readValue(
      data,
      'premiumMonthlyActiveReserved',
      'premium_monthly_active_reserved'
    ),
    'premiumMonthlyActiveReserved'
  )
  const premiumMonthlyRemainingToStart = requireNumber(
    readValue(
      data,
      'premiumMonthlyRemainingToStart',
      'premium_monthly_remaining_to_start'
    ),
    'premiumMonthlyRemainingToStart'
  )
  const monthlyLimit = requireNullableNumber(
    readValue(data, 'monthlyLimit', 'monthly_limit'),
    'monthlyLimit'
  )
  const remainingToStart = requireNullableNumber(
    readValue(data, 'remainingToStart', 'remaining_to_start'),
    'remainingToStart'
  )
  const remaining = requireNullableNumber(data.remaining, 'remaining')
  const canStartAiJob = requireBooleanValue(
    readValue(data, 'canStartAiJob', 'can_start_ai_job'),
    'canStartAiJob'
  )
  const isPremiumOrTester = requireBooleanValue(
    readValue(data, 'isPremiumOrTester', 'is_premium_or_tester'),
    'isPremiumOrTester'
  )
  const premiumActive = requireBooleanValue(
    readValue(data, 'premiumActive', 'premium_active'),
    'premiumActive'
  )
  const isTestUser = requireBooleanValue(
    readValue(data, 'isTestUser', 'is_test_user'),
    'isTestUser'
  )

  if (premiumActive && plan !== 'premium') {
    throw new Error('AI access response had inconsistent Premium state.')
  }

  return {
    allowed,
    reason,
    plan,
    blockReason,
    role,
    freeLimit,
    usedSuccessfulGenerations,
    activeReserved,
    freeSuccessfulUsed,
    freeActiveReserved,
    freeRemainingToStart,
    premiumMonthlyLimit,
    premiumMonthlySuccessfulUsed,
    premiumMonthlyActiveReserved,
    premiumMonthlyRemainingToStart,
    monthlyLimit,
    remainingToStart,
    remaining,
    canStartAiJob,
    isPremiumOrTester,
    premiumActive,
    isTestUser,
  }
}

export function reserveAiAccessForCreatedJob(
  current: AiAccessState | undefined
): AiAccessState | undefined {
  if (!current) {
    return current
  }

  const premium = current.plan === 'premium' || current.premiumActive
  const remainingToStart = decrement(current.remainingToStart)
  const remaining = decrement(current.remaining)

  if (premium) {
    return {
      ...current,
      plan: current.plan,
      premiumActive: current.premiumActive,
      activeReserved: current.activeReserved + 1,
      premiumMonthlyActiveReserved:
        current.premiumMonthlyActiveReserved + 1,
      premiumMonthlyRemainingToStart: decrement(
        current.premiumMonthlyRemainingToStart
      ),
      remainingToStart,
      remaining,
    }
  }

  return {
    ...current,
    activeReserved: current.activeReserved + 1,
    freeActiveReserved: current.freeActiveReserved + 1,
    freeRemainingToStart: decrement(current.freeRemainingToStart),
    remainingToStart,
    remaining,
  }
}

export function getAiAccessQuotaPresentation(
  access: AiAccessState | undefined,
  query: QueryPresentationState
): AiAccessQuotaPresentation {
  if (!access) {
    return {
      plan: 'unknown',
      label: null,
      allowanceText: 'Checking your AI recipe allowance…',
      statusText: query.hasError
        ? 'Could not check your allowance. Try again.'
        : null,
      isInitialLoading: query.isPending,
      isRefreshing: false,
      hasRefreshWarning: false,
    }
  }

  const premium = access.plan === 'premium' || access.premiumActive
  const remaining = premium
    ? access.premiumMonthlyRemainingToStart
    : access.freeRemainingToStart
  const noun = remaining === 1 ? 'recipe' : 'recipes'
  const reservation = premium
    ? access.premiumMonthlyActiveReserved
    : access.freeActiveReserved

  return {
    plan: premium ? 'premium' : 'free',
    label: `${remaining} left`,
    allowanceText: `${remaining} AI ${noun} available`,
    statusText: query.hasError
      ? 'Could not update usage. Showing your last confirmed allowance.'
      : query.isFetching
        ? 'Updating usage…'
        : reservation > 0
          ? `${reservation} AI ${reservation === 1 ? 'recipe is' : 'recipes are'} processing`
          : null,
    isInitialLoading: false,
    isRefreshing: query.isFetching,
    hasRefreshWarning: query.hasError,
  }
}

function decrement(value: number): number
function decrement(value: number | null): number | null
function decrement(value: number | null) {
  return typeof value === 'number' ? Math.max(0, value - 1) : null
}

function readValue(
  data: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (Object.hasOwn(data, key)) {
      return data[key]
    }
  }
  return undefined
}

function requireNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`AI access response was missing ${field}.`)
  }
  return value
}

function requireNullableNumber(value: unknown, field: string) {
  if (value === null) {
    return null
  }
  return requireNumber(value, field)
}

function requireBoolean(
  data: Record<string, unknown>,
  field: string
) {
  return requireBooleanValue(data[field], field)
}

function requireBooleanValue(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`AI access response was missing ${field}.`)
  }
  return value
}

function requireString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`AI access response was missing ${field}.`)
  }
  return value
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`AI access response was missing ${field}.`)
  }
  return value as T[number]
}

function requireNullableEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] | null {
  if (value === null) {
    return null
  }
  return requireEnum(value, allowed, field)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
