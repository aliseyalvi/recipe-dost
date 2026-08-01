import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  compareActiveMediaJobs,
  compareLibraryRecentItems,
  selectHomeRecentItems,
} from '../src/features/media-jobs/media-job-list-policy.ts'

const processingJob = activeJob({
  id: 'processing',
  status: 'analyzing',
  created_at: '2026-07-30T10:02:00.000Z',
  started_at: '2026-07-30T10:03:00.000Z',
})
const firstQueuedJob = activeJob({
  id: 'queued-a',
  status: 'queued',
  created_at: '2026-07-30T10:00:00.000Z',
})
const secondQueuedJob = activeJob({
  id: 'queued-b',
  status: 'queued',
  created_at: '2026-07-30T10:01:00.000Z',
})

test('one and three active jobs remain individually renderable', () => {
  assert.equal([processingJob].sort(compareActiveMediaJobs).length, 1)
  assert.deepEqual(
    [secondQueuedJob, processingJob, firstQueuedJob]
      .sort(compareActiveMediaJobs)
      .map((job) => job.id),
    ['processing', 'queued-a', 'queued-b']
  )
})

test('processing jobs precede queued jobs and queued jobs remain FIFO', () => {
  const jobs = [
    activeJob({
      id: 'later-processing',
      status: 'downloading',
      started_at: '2026-07-30T10:04:00.000Z',
    }),
    secondQueuedJob,
    firstQueuedJob,
    processingJob,
  ].sort(compareActiveMediaJobs)

  assert.deepEqual(jobs.map((job) => job.id), [
    'processing',
    'later-processing',
    'queued-a',
    'queued-b',
  ])
})

test('Home active query is bounded, deterministic, and never limited to one row', () => {
  const api = source('../src/lib/api/recipes.ts')
  const query = between(
    api,
    'export async function getActiveMediaJobs',
    'export async function updateSavedRecipeCaption'
  )

  assert.match(query, /\.in\('status', \[\.\.\.CANONICAL_ACTIVE_MEDIA_JOB_STATUSES\]\)/)
  assert.match(query, /\.order\('created_at', \{ ascending: true \}\)/)
  assert.match(query, /\.order\('id', \{ ascending: true \}\)/)
  assert.match(query, /\.limit\(boundedLimit\)/)
  assert.doesNotMatch(query, /\.limit\(1\)/)
})

test('Home In progress gallery is horizontal, keyed by job ID, and absent for no jobs', () => {
  const home = source('../app/(tabs)/home.tsx')

  assert.match(home, /activeJobs\.length > 0 \? \([\s\S]*title="In progress"/)
  assert.match(home, /<FlatList[\s\S]*horizontal/)
  assert.match(home, /keyExtractor=\{\(job\) => job\.id\}/)
})

test('completed jobs move from In progress to Recent without duplicate cards', () => {
  const activeRecipe = libraryItem({
    id: 'recipe-a',
    latest_media_job: mediaJob({
      id: 'job-a',
      recipe_item_id: 'recipe-a',
      status: 'analyzing',
    }),
  })

  assert.equal(selectHomeRecentItems([activeRecipe], [
    activeJob({
      id: 'job-a',
      recipe_item_id: 'recipe-a',
      status: 'analyzing',
    }),
  ]).length, 0)

  const completedRecipe = libraryItem({
    id: 'recipe-a',
    latest_card: {
      id: 'card-a',
      created_at: '2026-07-30T10:05:00.000Z',
      updated_at: '2026-07-30T10:05:00.000Z',
    },
    latest_media_job: mediaJob({
      id: 'job-a',
      recipe_item_id: 'recipe-a',
      result_recipe_card_id: 'card-a',
      status: 'completed',
      completed_at: '2026-07-30T10:05:00.000Z',
      updated_at: '2026-07-30T10:05:00.000Z',
    }),
  })
  const duplicateCardLink = libraryItem({
    id: 'recipe-b',
    latest_media_job: mediaJob({
      id: 'job-b',
      recipe_item_id: 'recipe-b',
      result_recipe_card_id: 'card-a',
      status: 'completed',
    }),
  })
  const recent = selectHomeRecentItems(
    [duplicateCardLink, completedRecipe],
    []
  )

  assert.equal(recent.length, 1)
  assert.equal(recent[0].id, 'recipe-a')
})

test('Library prioritizes processing, queued FIFO, retryable failures, completed, then other failures', () => {
  const items = [
    libraryItem({
      id: 'non-retryable-failed',
      latest_media_job: mediaJob({ status: 'failed', updated_at: '2026-07-30T10:09:00.000Z' }),
    }),
    libraryItem({
      id: 'completed-old',
      latest_card: {
        id: 'card-old',
        created_at: '2026-07-30T10:04:00.000Z',
        updated_at: '2026-07-30T10:04:00.000Z',
      },
      latest_media_job: mediaJob({ status: 'completed', completed_at: '2026-07-30T10:04:00.000Z' }),
    }),
    libraryItem({
      id: 'completed-new',
      latest_card: {
        id: 'card-new',
        created_at: '2026-07-30T10:05:00.000Z',
        updated_at: '2026-07-30T10:05:00.000Z',
      },
      latest_media_job: mediaJob({ status: 'completed', completed_at: '2026-07-30T10:05:00.000Z' }),
    }),
    libraryItem({
      id: 'retryable-failed',
      latest_media_job: mediaJob({
        status: 'failed',
        source_metadata: { retryable: true },
      }),
    }),
    libraryItem({ id: 'queued-b', latest_media_job: secondQueuedJob }),
    libraryItem({ id: 'processing', latest_media_job: processingJob }),
    libraryItem({ id: 'queued-a', latest_media_job: firstQueuedJob }),
  ].sort(compareLibraryRecentItems)

  assert.deepEqual(items.map((item) => item.id), [
    'processing',
    'queued-a',
    'queued-b',
    'retryable-failed',
    'completed-new',
    'completed-old',
    'non-retryable-failed',
  ])
})

test('Instagram, TikTok, and YouTube share the same Library comparator', () => {
  for (const platform of ['instagram', 'tiktok', 'youtube']) {
    const items = [
      libraryItem({ id: `${platform}-queued`, platform, latest_media_job: firstQueuedJob }),
      libraryItem({ id: `${platform}-processing`, platform, latest_media_job: processingJob }),
    ].sort(compareLibraryRecentItems)

    assert.equal(items[0].id, `${platform}-processing`)
  }
})

function activeJob(overrides = {}) {
  return {
    id: 'job',
    recipe_item_id: 'recipe',
    platform: 'youtube',
    status: 'queued',
    source_metadata: {},
    thumbnail_url: null,
    result_recipe_card_id: null,
    started_at: null,
    created_at: '2026-07-30T10:00:00.000Z',
    updated_at: '2026-07-30T10:00:00.000Z',
    ...overrides,
  }
}

function mediaJob(overrides = {}) {
  return {
    ...activeJob(),
    ai_provider: null,
    source_mode: 'youtube_url',
    progress: 0,
    error_code: null,
    error_message: null,
    media_duration_seconds: null,
    retry_requested_at: null,
    user_retry_count: 0,
    completed_at: null,
    ...overrides,
  }
}

function libraryItem(overrides = {}) {
  return {
    id: 'recipe',
    platform: 'youtube',
    metadata_status: 'completed',
    source_metadata: {},
    is_favorite: false,
    created_at: '2026-07-30T09:00:00.000Z',
    updated_at: '2026-07-30T09:00:00.000Z',
    latest_card: null,
    latest_media_job: null,
    ...overrides,
  }
}

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function between(value, start, end) {
  return value.slice(value.indexOf(start), value.indexOf(end))
}
