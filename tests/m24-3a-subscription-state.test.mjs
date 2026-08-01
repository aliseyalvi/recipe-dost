import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  deriveSubscriptionState,
  getLocalEntitlementEvidence,
} from '../src/features/subscription/subscription-state.ts'
import { getNormalizedSubscriptionStatus } from '../src/features/subscription/normalized-subscription-status.ts'

const freeAccess = access({ premiumActive: false, plan: 'free', canStartAiJob: false })
const premiumAccess = access({ premiumActive: true, plan: 'premium', canStartAiJob: true })
const premiumQuotaExhausted = access({
  premiumActive: true,
  plan: 'premium',
  canStartAiJob: false,
  blockReason: 'premium_monthly_limit_reached',
  premiumMonthlySuccessfulUsed: 100,
  premiumMonthlyRemainingToStart: 0,
  remainingToStart: 0,
})
const premiumReservationBlocked = access({
  premiumActive: true,
  plan: 'premium',
  canStartAiJob: false,
  blockReason: 'active_ai_job_limit_reached',
  premiumMonthlySuccessfulUsed: 3,
  premiumMonthlyActiveReserved: 1,
  premiumMonthlyRemainingToStart: 96,
  remainingToStart: 96,
})
const localActive = {
  active: true,
  expirationDate: '2099-01-01T00:00:00.000Z',
  expirationRelation: 'future',
  providerEnvironment: 'sandbox',
}
const localExpired = {
  active: false,
  expirationDate: '2020-01-01T00:00:00.000Z',
  expirationRelation: 'expired',
  providerEnvironment: 'sandbox',
}

test('backend Premium is the only route to confirmed Premium', () => {
  assert.equal(deriveSubscriptionState({ backendAccess: premiumAccess, localEvidence: localActive }).kind, 'premium_confirmed')
  const pending = deriveSubscriptionState({ backendAccess: freeAccess, localEvidence: localActive })
  assert.equal(pending.kind, 'store_premium_backend_pending')
  assert.equal(getNormalizedSubscriptionStatus(pending).isPremium, false)
  assert.doesNotMatch(getNormalizedSubscriptionStatus(pending).statusSubtitle, /active/i)
})

test('confirmed Premium keeps entitlement separate from immediate generation eligibility', () => {
  const available = deriveSubscriptionState({
    backendAccess: access({
      premiumActive: true,
      plan: 'premium',
      canStartAiJob: true,
      premiumMonthlySuccessfulUsed: 3,
      premiumMonthlyRemainingToStart: 97,
      remainingToStart: 97,
    }),
    localEvidence: localActive,
  })
  assert.equal(available.kind, 'premium_confirmed')
  assert.equal(available.backendPremiumActive, true)
  assert.equal(available.backendCanStartAiJob, true)
  assert.equal(
    getNormalizedSubscriptionStatus(available).statusSubtitle,
    '97 AI recipes left this month'
  )

  const exhausted = deriveSubscriptionState({
    backendAccess: premiumQuotaExhausted,
    localEvidence: localActive,
    restoreCompleted: true,
    trigger: 'restore',
  })
  assert.equal(exhausted.kind, 'premium_confirmed')
  assert.equal(exhausted.backendPremiumActive, true)
  assert.equal(exhausted.backendCanStartAiJob, false)
  assert.equal(exhausted.backendBlockReason, 'premium_monthly_limit_reached')
  assert.equal(exhausted.successfulUsed, 100)
  assert.equal(exhausted.monthlyLimit, 100)
  assert.equal(exhausted.remainingToStart, 0)
  assert.equal(
    getNormalizedSubscriptionStatus(exhausted).statusTitle,
    'Premium is active'
  )
  assert.equal(
    getNormalizedSubscriptionStatus(exhausted).statusSubtitle,
    'You have used all 100 AI recipes for this billing period.'
  )
})

test('confirmed Premium explains an active reservation without becoming pending', () => {
  const state = deriveSubscriptionState({
    backendAccess: premiumReservationBlocked,
    localEvidence: localActive,
  })
  const status = getNormalizedSubscriptionStatus(state)
  assert.equal(state.kind, 'premium_confirmed')
  assert.equal(state.activeReserved, 1)
  assert.equal(status.isPremium, true)
  assert.equal(
    status.statusSubtitle,
    'An AI recipe is already being processed. Try again when it finishes.'
  )
})

test('confirmed Premium uses safe fallback copy for another normalized block reason', () => {
  const state = deriveSubscriptionState({
    backendAccess: access({
      premiumActive: true,
      plan: 'premium',
      canStartAiJob: false,
      blockReason: 'free_ai_limit_reached',
      premiumMonthlySuccessfulUsed: 20,
      premiumMonthlyRemainingToStart: 80,
      remainingToStart: 80,
    }),
    localEvidence: localActive,
  })
  assert.equal(state.kind, 'premium_confirmed')
  assert.equal(
    getNormalizedSubscriptionStatus(state).statusSubtitle,
    'AI recipe generation is temporarily unavailable.'
  )
})

test('restore distinguishes expired and no active entitlement without false success', () => {
  const expired = deriveSubscriptionState({
    backendAccess: freeAccess,
    localEvidence: localExpired,
    restoreCompleted: true,
    trigger: 'restore',
  })
  assert.equal(expired.kind, 'expired')
  assert.equal(getNormalizedSubscriptionStatus(expired).statusSubtitle, 'Your previous subscription has expired.')

  const absent = deriveSubscriptionState({
    backendAccess: freeAccess,
    restoreCompleted: true,
    trigger: 'restore',
  })
  assert.equal(absent.kind, 'restore_no_active_entitlement')
  assert.equal(getNormalizedSubscriptionStatus(absent).statusSubtitle, 'No active subscription was found for this store account.')
})

test('typed binding conflict is support-oriented and never Premium', () => {
  const state = deriveSubscriptionState({
    backendAccess: freeAccess,
    localEvidence: localActive,
    errorCode: 'revenuecat_binding_conflict',
  })
  const status = getNormalizedSubscriptionStatus(state)
  assert.equal(state.kind, 'binding_conflict')
  assert.equal(status.isPremium, false)
  assert.match(status.statusSubtitle, /Contact support/)
})

test('transient failure preserves cached confirmed Premium but known Free does not', () => {
  assert.equal(deriveSubscriptionState({
    lastSuccessfulBackendAccess: premiumAccess,
    errorCode: 'timeout',
  }).kind, 'refresh_failed_cached_premium')
  assert.equal(deriveSubscriptionState({
    backendAccess: freeAccess,
    lastSuccessfulBackendAccess: premiumAccess,
  }).kind, 'free')
})

test('local entitlement evidence detects future, boundary/past, and sandbox', () => {
  const customerInfo = {
    entitlements: {
      active: { premium: entitlement('2099-01-01T00:00:00.000Z', true) },
      all: { premium: entitlement('2099-01-01T00:00:00.000Z', true) },
    },
  }
  const future = getLocalEntitlementEvidence(customerInfo, 'premium', Date.parse('2098-01-01T00:00:00.000Z'))
  assert.deepEqual(future, {
    active: true,
    expirationDate: '2099-01-01T00:00:00.000Z',
    expirationRelation: 'future',
    providerEnvironment: 'sandbox',
  })
  const boundary = getLocalEntitlementEvidence(customerInfo, 'premium', Date.parse('2099-01-01T00:00:00.000Z'))
  assert.equal(boundary.expirationRelation, 'expired')
})

test('mobile architecture has one query key, shared-Promise sync, and one SDK listener lifecycle', () => {
  const query = source('../src/lib/query/ai-access-query.ts')
  const provider = source('../src/providers/revenuecat-provider.tsx')
  const reconciliation = source('../src/features/subscription/subscription-reconciliation.ts')
  const appSources = [
    '../app/(tabs)/home.tsx',
    '../app/(tabs)/library.tsx',
    '../app/(tabs)/grocery.tsx',
    '../app/(tabs)/settings.tsx',
    '../app/paywall.tsx',
    '../app/recipe/[id].tsx',
  ].map(source).join('\n')
  assert.match(query, /\['ai-access-state'\]/)
  assert.doesNotMatch(appSources, /\['ai-access-state',\s*['"](?:home|library|grocery|settings|paywall|recipe-detail)/)
  assert.match(reconciliation, /Map<[^>]*Promise<SubscriptionSyncResult>/s)
  assert.match(provider, /Purchases\.addCustomerInfoUpdateListener\(listener\)/)
  assert.match(provider, /Purchases\.removeCustomerInfoUpdateListener\(listener\)/)
  assert.equal((provider.match(/addCustomerInfoUpdateListener/g) ?? []).length, 1)
})

test('installed RevenueCat 10.4.0 exposes every API used by the state machine', () => {
  const packageJson = JSON.parse(source('../node_modules/react-native-purchases/package.json'))
  const declarations = source('../node_modules/react-native-purchases/dist/purchases.d.ts')
  assert.equal(packageJson.version, '10.4.0')
  for (const api of [
    'addCustomerInfoUpdateListener',
    'removeCustomerInfoUpdateListener',
    'invalidateCustomerInfoCache',
    'getCustomerInfo',
    'restorePurchases',
  ]) {
    assert.match(declarations, new RegExp(`${api}\\(`))
  }
})

test('restore, refresh, and purchase orchestration each contain one backend reconciliation', () => {
  const provider = source('../src/providers/revenuecat-provider.tsx')
  const restoreBlock = between(provider, 'const restoreSubscription', 'const purchaseSubscription')
  const refreshBlock = between(provider, 'const refreshSubscription', 'const restoreSubscription')
  const purchaseBlock = between(provider, 'const purchaseSubscription', 'const refreshOfferings')
  assert.equal((restoreBlock.match(/reconcileSubscription\('restore'\)/g) ?? []).length, 1)
  assert.equal((refreshBlock.match(/reconcileSubscription\('refresh'\)/g) ?? []).length, 1)
  assert.equal((purchaseBlock.match(/reconcileSubscription\('purchase'\)/g) ?? []).length, 1)
  assert.match(refreshBlock, /invalidateCustomerInfoCache/)
  assert.match(restoreBlock, /restoreInFlightRef\.current/)
})

test('Restore and Purchase confirm Premium without requiring canStartAiJob', () => {
  const settings = source('../app/(tabs)/settings.tsx')
  const paywall = source('../app/paywall.tsx')
  const settingsRestore = between(settings, 'const handleRestorePurchases', 'const handleManageSubscription')
  const paywallPurchase = between(paywall, 'const handlePurchase', 'const handleRestore')
  const paywallRestore = between(paywall, 'const handleRestore', 'const handleRetryOfferings')

  assert.match(settingsRestore, /result\.state\.kind === 'premium_confirmed'/)
  assert.match(settingsRestore, /Premium access has been restored\./)
  assert.doesNotMatch(settingsRestore, /backendCanStartAiJob/)
  assert.match(paywallPurchase, /closePaywall\('purchase_completed'/)
  assert.doesNotMatch(paywallPurchase, /backendCanStartAiJob/)
  assert.match(paywallRestore, /Premium access has been restored\./)
  assert.doesNotMatch(paywallRestore, /backendCanStartAiJob/)
})

test('Generate removes try-again false success and performs at most one automatic retry', () => {
  const detail = source('../app/recipe/[id].tsx')
  assert.doesNotMatch(detail, /Premium access synced\. Please try again/)
  assert.match(detail, /reconcileSubscription\('generate'\)/)
  assert.match(detail, /const retriedJob = await createMediaJob/)
  assert.match(detail, /!subscriptionStatus\.isPremium/)
  assert.match(detail, /subscriptionState\.kind === 'store_premium_backend_pending'/)
})

function access(overrides) {
  const premiumMonthlySuccessfulUsed = overrides.premiumMonthlySuccessfulUsed ?? 0
  const premiumMonthlyActiveReserved = overrides.premiumMonthlyActiveReserved ?? 0
  const premiumMonthlyRemainingToStart =
    overrides.premiumMonthlyRemainingToStart ??
    (overrides.canStartAiJob ? 100 : 0)
  return {
    allowed: overrides.canStartAiJob,
    reason: overrides.premiumActive ? 'premium_active' : 'limit_reached',
    plan: overrides.plan,
    blockReason:
      overrides.blockReason ??
      (overrides.canStartAiJob ? null : 'free_ai_limit_reached'),
    role: 'user', freeLimit: 3, usedSuccessfulGenerations: 3,
    activeReserved: overrides.activeReserved ?? premiumMonthlyActiveReserved,
    freeSuccessfulUsed: 3, freeActiveReserved: 0,
    freeRemainingToStart: 0, premiumMonthlyLimit: 100,
    premiumMonthlySuccessfulUsed,
    premiumMonthlyActiveReserved,
    premiumMonthlyRemainingToStart,
    monthlyLimit: overrides.premiumActive ? 100 : null,
    remainingToStart:
      overrides.remainingToStart ??
      (overrides.canStartAiJob ? 100 : 0),
    remaining: overrides.canStartAiJob ? 100 : 0,
    canStartAiJob: overrides.canStartAiJob,
    isPremiumOrTester: overrides.premiumActive,
    premiumActive: overrides.premiumActive,
    isTestUser: false,
  }
}

function entitlement(expirationDate, isSandbox) {
  return { expirationDate, isSandbox }
}

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function between(value, start, end) {
  return value.slice(value.indexOf(start), value.indexOf(end))
}
