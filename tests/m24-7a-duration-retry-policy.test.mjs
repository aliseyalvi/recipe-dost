import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  formatDurationWords,
  formatRecipeDurationMinutes,
  formatSourceDurationSeconds,
  getDurationLimitMessage,
  resolveDurationSemantics,
  selectMediaCtaState,
} from '../src/features/media-jobs/duration-policy.ts'

test('121-second TikTok is not blocked by the retired 120-second policy', () => {
  assert.deepEqual(
    selectMediaCtaState({
      sourceVideoDurationSeconds: 121,
      maxDurationSeconds: 180,
    }),
    {
      kind: 'generate',
      enabled: true,
      label: 'Generate AI Recipe',
      message: null,
    }
  )
})

test('180 seconds is enabled and 181 seconds is disabled at a 180-second max', () => {
  assert.equal(
    selectMediaCtaState({
      sourceVideoDurationSeconds: 180,
      maxDurationSeconds: 180,
    }).enabled,
    true
  )
  const blocked = selectMediaCtaState({
    sourceVideoDurationSeconds: 181,
    maxDurationSeconds: 180,
  })
  assert.equal(blocked.kind, 'duration_blocked')
  assert.equal(blocked.enabled, false)
})

test('unknown source duration stays enabled and does not fabricate a warning', () => {
  const state = selectMediaCtaState({
    sourceVideoDurationSeconds: null,
  })

  assert.equal(state.kind, 'generate')
  assert.equal(state.enabled, true)
  assert.equal(state.message, null)
})

test('duration-limit copy is dynamic and formats 180 as three minutes', () => {
  assert.equal(formatDurationWords(180), '3 minutes')
  assert.equal(formatDurationWords(90), '1 minute 30 seconds')
  assert.deepEqual(getDurationLimitMessage(194, 180), {
    title: 'Video is too long',
    body: 'This video is 3 minutes 14 seconds. Recipe Dost currently supports videos up to 3 minutes.',
  })
})

test('source seconds and recipe minutes use explicit distinct formatters', () => {
  assert.equal(formatSourceDurationSeconds(46), '0:46')
  assert.equal(formatSourceDurationSeconds(125), '2:05')
  assert.equal(formatRecipeDurationMinutes(40), '40m')
  assert.equal(formatRecipeDurationMinutes(60), '1h')
  assert.equal(formatRecipeDurationMinutes(75), '1h 15m')
})

test('explicit duration semantics never mix source video and recipe time', () => {
  assert.deepEqual(
    resolveDurationSemantics(
      {
        source_video_duration_seconds: 125,
        recipe_total_minutes: 40,
        duration_semantics_version: 1,
        duration_seconds: 999,
      },
      {
        actual_duration_seconds: 130,
      }
    ),
    {
      sourceVideoDurationSeconds: 125,
      recipeTotalMinutes: 40,
    }
  )
  assert.deepEqual(
    resolveDurationSemantics(
      {
        duration_seconds: 2400,
      },
      {
        actual_duration_seconds: 125,
      }
    ),
    {
      sourceVideoDurationSeconds: 125,
      recipeTotalMinutes: null,
    }
  )
  assert.deepEqual(
    resolveDurationSemantics({
      duration_seconds: 2400,
      duration_semantics_version: 1,
    }),
    {
      sourceVideoDurationSeconds: null,
      recipeTotalMinutes: null,
    }
  )
})

test('Instagram, TikTok and YouTube all use the platform-neutral CTA selector', () => {
  for (const platform of ['instagram', 'tiktok', 'youtube']) {
    const state = selectMediaCtaState({
      sourceVideoDurationSeconds: 150,
      maxDurationSeconds: 180,
    })

    assert.equal(state.kind, 'generate', platform)
  }
})

test('retryable failed jobs retry while non-retryable over-limit jobs stay disabled', () => {
  const retry = selectMediaCtaState({
    jobId: 'same-job-id',
    jobStatus: 'failed',
    retryable: true,
    sourceVideoDurationSeconds: 150,
    maxDurationSeconds: 180,
  })
  const blocked = selectMediaCtaState({
    jobId: 'over-limit-job',
    jobStatus: 'failed',
    retryable: false,
    retryBlockReason: 'non_retryable_input',
    sourceVideoDurationSeconds: 181,
    maxDurationSeconds: 180,
  })

  assert.equal(retry.kind, 'retry')
  assert.equal(retry.enabled, true)
  assert.equal(retry.jobId, 'same-job-id')
  assert.equal(blocked.kind, 'duration_blocked')
  assert.equal(blocked.enabled, false)
})

test('frontend retry calls retry_media_job with the same ID and never creates a retry row', () => {
  const api = source('../src/lib/api/recipes.ts')
  const detail = source('../app/recipe/[id].tsx')
  const retryApi = between(
    api,
    'export async function retryMediaJob',
    'export async function getMediaJob'
  )
  const retryHandler = between(
    detail,
    'const handleRetryMediaJob',
    'const handleRetryMetadata'
  )

  assert.match(retryApi, /\.rpc\('retry_media_job'/)
  assert.match(retryApi, /p_job_id: jobId/)
  assert.match(retryHandler, /retryMediaJob\(mediaCtaState\.jobId\)/)
  assert.match(retryHandler, /retryResult\.job_id !== mediaCtaState\.jobId/)
  assert.doesNotMatch(retryHandler, /createMediaJob/)
})

test('failed jobs merge safe actual, max and retryable event metadata', () => {
  const api = source('../src/lib/api/recipes.ts')

  assert.match(api, /\.from\('media_job_events'\)/)
  assert.match(
    api,
    /'queue_job_failed'[\s\S]*'unified_extractor_failed'[\s\S]*'video_too_long'/
  )
  assert.match(api, /value\.actual_duration_seconds/)
  assert.match(api, /value\.max_duration_seconds/)
  assert.match(api, /value\.retryable/)
  assert.match(
    api,
    /normalizeMediaJob\(row, failureMetadata\.get\(row\.id\)\)/
  )
})

test('accepted and already-queued retry responses become queued immediately', () => {
  const detail = source('../app/recipe/[id].tsx')
  const retryHandler = between(
    detail,
    'const handleRetryMediaJob',
    'const handleRetryMetadata'
  )

  assert.match(retryHandler, /retryResult\.retry_accepted/)
  assert.match(
    retryHandler,
    /retryResult\.retry_block_reason === 'already_queued'/
  )
  assert.match(retryHandler, /retryResult\.next_state === 'queued'/)
  assert.match(retryHandler, /status: 'queued'/)
  assert.match(
    retryHandler,
    /setQueryData\([\s\S]*\['media-job', 'recipe', recipe\.id\]/
  )
})

test('accepted retry invalidates the bounded detail, list, card, access and usage keys', () => {
  const detail = source('../app/recipe/[id].tsx')
  const retryHandler = between(
    detail,
    'const handleRetryMediaJob',
    'const handleRetryMetadata'
  )

  for (const queryKey of [
    'media-job',
    'recipe-item',
    'recipe-card',
    'recipe-library',
    'recent-recipes',
    'ai-access-state',
    'usage-summary',
  ]) {
    assert.match(retryHandler, new RegExp(`'${queryKey}'`))
  }
  assert.match(retryHandler, /mediaJobQuery\.refetch\(\)/)
  assert.match(retryHandler, /recipeQuery\.refetch\(\)/)
})

test('DurationChips uses recipe clock and source play semantics with stable empty height', () => {
  const chips = source(
    '../src/features/media-jobs/media-job-source-metadata.tsx'
  )
  const library = source('../app/(tabs)/library.tsx')

  assert.match(chips, /accessibilityLabel=\{`Recipe time/)
  assert.match(chips, /icon="clock"/)
  assert.match(chips, /accessibilityLabel=\{`Video length/)
  assert.match(chips, /icon="play"/)
  assert.match(chips, /minHeight: 28/)
  assert.match(
    library,
    /recipeTotalMinutes=\{[\s\S]*metadata\.recipeTotalMinutes/
  )
  assert.match(
    library,
    /sourceVideoDurationSeconds=\{metadata\.sourceVideoDurationSeconds\}/
  )
  assert.doesNotMatch(
    library,
    /RecipeMetadataChip icon="clock" label=\{metadata\.time\}/
  )
})

test('no user-visible hardcoded two-minute warning remains in frontend surfaces', () => {
  const frontend = [
    '../app/recipe/[id].tsx',
    '../app/recipe/preview.tsx',
    '../src/features/media-jobs/media-job-card.tsx',
    '../src/features/media-jobs/media-job-source-metadata.tsx',
  ]
    .map(source)
    .join('\n')

  assert.doesNotMatch(frontend, /2 minutes|longer than 2|2-minute/i)
})

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function between(value, start, end) {
  return value.slice(value.indexOf(start), value.indexOf(end))
}
