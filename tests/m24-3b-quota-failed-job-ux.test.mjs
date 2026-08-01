import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  getAiAccessQuotaPresentation,
  normalizeAiAccessState,
  reserveAiAccessForCreatedJob,
} from '../src/features/ai-access/ai-access-state.ts'
import {
  MediaJobStartGuard,
  retryAiGenerationWithAuthoritativeAccess,
} from '../src/features/media-jobs/media-job-start-guard.ts'
import { shouldRefreshAiAccessForTerminalJob } from '../src/features/media-jobs/terminal-ai-access-refresh.ts'
import { getFailedJobPresentation } from '../src/features/recipe-detail/failed-job-presentation.ts'

test('Premium snapshot remains visible with a subtle background refresh state', () => {
  const snapshot = premiumAccess()
  const presentation = getAiAccessQuotaPresentation(snapshot, {
    isPending: false,
    isFetching: true,
    hasError: false,
  })

  assert.equal(presentation.plan, 'premium')
  assert.equal(presentation.label, '92 left')
  assert.equal(presentation.allowanceText, '92 AI recipes available')
  assert.equal(presentation.statusText, 'Updating usage…')
  assert.equal(presentation.isRefreshing, true)
})

test('missing query data remains unknown and never becomes Free or zero', () => {
  const presentation = getAiAccessQuotaPresentation(undefined, {
    isPending: true,
    isFetching: true,
    hasError: false,
  })

  assert.equal(presentation.plan, 'unknown')
  assert.equal(presentation.label, null)
  assert.equal(
    presentation.allowanceText,
    'Checking your AI recipe allowance…'
  )
  assert.doesNotMatch(presentation.allowanceText, /free|0 left/i)
})

test('failed refresh preserves a known Premium snapshot with a warning', () => {
  const presentation = getAiAccessQuotaPresentation(premiumAccess(), {
    isPending: false,
    isFetching: false,
    hasError: true,
  })

  assert.equal(presentation.plan, 'premium')
  assert.equal(presentation.label, '92 left')
  assert.equal(presentation.hasRefreshWarning, true)
  assert.match(presentation.statusText, /last confirmed allowance/)
})

test('partial AI-access payload cannot replace authoritative Premium with Free or zero', () => {
  assert.throws(
    () =>
      normalizeAiAccessState({
        allowed: false,
        reason: 'limit_reached',
        remaining: 0,
      }),
    /incomplete|missing/
  )

  const normalized = normalizeAiAccessState(premiumAccess())
  assert.equal(normalized.plan, 'premium')
  assert.equal(normalized.premiumActive, true)
  assert.equal(normalized.remainingToStart, 92)
})

test('job creation optimistic reservation preserves Premium and successful usage', () => {
  const snapshot = premiumAccess()
  const reserved = reserveAiAccessForCreatedJob(snapshot)

  assert.ok(reserved)
  assert.equal(reserved.plan, 'premium')
  assert.equal(reserved.premiumActive, true)
  assert.equal(reserved.activeReserved, 3)
  assert.equal(reserved.premiumMonthlyActiveReserved, 3)
  assert.equal(reserved.remainingToStart, 91)
  assert.equal(reserved.premiumMonthlyRemainingToStart, 91)
  assert.equal(
    reserved.premiumMonthlySuccessfulUsed,
    snapshot.premiumMonthlySuccessfulUsed
  )
  assert.equal(
    reserved.usedSuccessfulGenerations,
    snapshot.usedSuccessfulGenerations
  )
})

test('failed terminal refetch restores the released reservation authoritatively', () => {
  const refreshed = new Set()
  const optimistic = reserveAiAccessForCreatedJob(premiumAccess())

  assert.equal(optimistic?.premiumMonthlyActiveReserved, 3)
  assert.equal(
    shouldRefreshAiAccessForTerminalJob(refreshed, {
      id: 'failed-job',
      status: 'failed',
    }),
    true
  )

  const backendAfterFailure = normalizeAiAccessState(premiumAccess())
  assert.equal(backendAfterFailure.premiumMonthlyActiveReserved, 2)
  assert.equal(backendAfterFailure.premiumMonthlySuccessfulUsed, 6)
  assert.equal(backendAfterFailure.premiumMonthlyRemainingToStart, 92)
})

test('successful terminal refetch converts reservation into successful usage', () => {
  const refreshed = new Set()
  assert.equal(
    shouldRefreshAiAccessForTerminalJob(refreshed, {
      id: 'completed-job',
      status: 'completed',
    }),
    true
  )

  const backendAfterSuccess = normalizeAiAccessState(
    premiumAccess({
      usedSuccessfulGenerations: 7,
      activeReserved: 1,
      premiumMonthlySuccessfulUsed: 7,
      premiumMonthlyActiveReserved: 1,
      premiumMonthlyRemainingToStart: 92,
      remainingToStart: 92,
      remaining: 92,
    })
  )
  assert.equal(backendAfterSuccess.premiumMonthlySuccessfulUsed, 7)
  assert.equal(backendAfterSuccess.premiumMonthlyActiveReserved, 1)
  assert.equal(backendAfterSuccess.premiumMonthlyRemainingToStart, 92)
})

test('duplicate terminal events trigger one authoritative access refresh', () => {
  const refreshed = new Set()
  const job = { id: 'same-job', status: 'failed' }

  assert.equal(shouldRefreshAiAccessForTerminalJob(refreshed, job), true)
  assert.equal(shouldRefreshAiAccessForTerminalJob(refreshed, job), false)
  assert.equal(
    shouldRefreshAiAccessForTerminalJob(refreshed, {
      id: 'same-job',
      status: 'completed',
    }),
    false
  )
})

test('logout and identity change clear only the previous user snapshot', () => {
  const authProvider = source('../src/providers/auth-provider.tsx')
  const queryModule = source('../src/lib/query/ai-access-query.ts')
  const revenueCatProvider = source('../src/providers/revenuecat-provider.tsx')

  assert.match(authProvider, /previousUserId && previousUserId !== userId/)
  assert.match(
    authProvider,
    /clearAiAccessForUser\(queryClient, previousUserId\)/
  )
  assert.match(queryModule, /removeQueries\(\{[\s\S]*exact: true/)
  assert.match(
    revenueCatProvider,
    /lastBackendAccessUserIdRef\.current !== \(user\?\.id \?\? null\)/
  )
  assert.match(
    revenueCatProvider,
    /lastSuccessfulBackendAccessRef\.current = null/
  )
  assert.doesNotMatch(
    queryModule,
    /placeholderData:[\s\S]*previousData/
  )
})

test('current watched attempt failure presents full once, then inline', () => {
  const full = getFailedJobPresentation({
    jobId: 'job-1',
    status: 'failed',
    previousStatus: 'analyzing',
    watchedJobId: 'job-1',
    wasPresented: false,
  })
  const duplicate = getFailedJobPresentation({
    jobId: 'job-1',
    status: 'failed',
    previousStatus: 'failed',
    watchedJobId: 'job-1',
    wasPresented: true,
  })
  const reopened = getFailedJobPresentation({
    jobId: 'job-1',
    status: 'failed',
    previousStatus: null,
    watchedJobId: null,
    wasPresented: false,
  })

  assert.equal(full, 'full')
  assert.equal(duplicate, 'inline')
  assert.equal(reopened, 'inline')
})

test('access-gated initial submission creates exactly one job', async () => {
  let accessCalls = 0
  let createCalls = 0

  const result = await retryAiGenerationWithAuthoritativeAccess({
    fetchAccess: () => {
      accessCalls += 1
      return Promise.resolve(premiumAccess())
    },
    createJob: () => {
      createCalls += 1
      return Promise.resolve({ id: 'new-job' })
    },
  })

  assert.deepEqual(result, { id: 'new-job' })
  assert.equal(accessCalls, 1)
  assert.equal(createCalls, 1)
})

test('double-tap submission shares the synchronous start guard and creates one job', async () => {
  const guard = new MediaJobStartGuard()
  let createCalls = 0
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  const operation = () =>
    guard.run(async () => {
      createCalls += 1
      await pending
      return 'created'
    })

  const first = operation()
  const second = operation()
  release()

  assert.equal(await first, 'created')
  assert.equal(await second, null)
  assert.equal(createCalls, 1)
})

test('failed job keeps thumbnail, title, and source metadata in the normal detail view', () => {
  const viewState = source(
    '../src/features/recipe-detail/recipe-detail-view-state.ts'
  )
  const detail = source('../app/recipe/[id].tsx')

  assert.match(
    viewState,
    /mediaJob\?\.status === 'failed'[\s\S]*return 'metadata_ready'/
  )
  assert.match(detail, /<RecipeMetadataState[\s\S]*thumbnailUrl=\{liveThumbnailUrl\}/)
  assert.match(detail, /title=\{normalizedDisplayTitle\}/)
  assert.match(detail, /<InlineAiFailureCard/)
  assert.match(detail, /Retry AI Recipe Generation/)
  assert.match(detail, /Continue viewing metadata/)
})

test('successful retry removes failure presentation and has no navigation loop', () => {
  assert.equal(
    getFailedJobPresentation({
      jobId: 'retry-job',
      status: 'completed',
      previousStatus: 'saving_result',
      watchedJobId: 'retry-job',
      wasPresented: false,
    }),
    'none'
  )

  const detail = source('../app/recipe/[id].tsx')
  const oneTimeFailureBlock = between(
    detail,
    'if (showOneTimeAiFailure)',
    "if (detailViewState === 'metadata_loading')"
  )
  assert.doesNotMatch(oneTimeFailureBlock, /router\.(?:push|replace)/)
  assert.match(oneTimeFailureBlock, /setFailedAttemptPresentationId\(null\)/)
})

test('request contracts for supported social sources remain unchanged', () => {
  const recipesApi = source('../src/lib/api/recipes.ts')
  const recipeTypes = source('../src/features/recipe-draft/types.ts')
  const createCall = between(
    recipesApi,
    'export async function createMediaJob',
    'export async function getMediaJob'
  )

  assert.match(createCall, /'create-media-job'/)
  assert.match(createCall, /recipe_item_id: recipeItemId/)
  assert.match(createCall, /secondary_recipe_language_code: secondaryRecipeLanguageCode/)
  assert.match(createCall, /source_url: sourceUrl/)
  assert.match(createCall, /platform,/)
  for (const platform of ['instagram', 'tiktok', 'youtube']) {
    assert.match(recipeTypes, new RegExp(`'${platform}'`))
  }
})

function premiumAccess(overrides = {}) {
  return {
    allowed: true,
    reason: 'premium_active',
    plan: 'premium',
    blockReason: null,
    role: 'user',
    freeLimit: 3,
    usedSuccessfulGenerations: 6,
    activeReserved: 2,
    freeSuccessfulUsed: 3,
    freeActiveReserved: 0,
    freeRemainingToStart: 0,
    premiumMonthlyLimit: 100,
    premiumMonthlySuccessfulUsed: 6,
    premiumMonthlyActiveReserved: 2,
    premiumMonthlyRemainingToStart: 92,
    monthlyLimit: 100,
    remainingToStart: 92,
    remaining: 92,
    canStartAiJob: true,
    isPremiumOrTester: true,
    premiumActive: true,
    isTestUser: false,
    ...overrides,
  }
}

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function between(value, start, end) {
  return value.slice(value.indexOf(start), value.indexOf(end))
}
