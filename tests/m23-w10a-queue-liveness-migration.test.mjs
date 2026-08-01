import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/202607290001_m23_w10a_queue_liveness.sql',
    import.meta.url
  ),
  'utf8'
).toLowerCase()

test('queue claim is atomic and deterministically FIFO', () => {
  assert.match(migration, /create or replace function public\.claim_oldest_media_job\(\)/)
  assert.match(
    migration,
    /order by media_jobs\.created_at asc, media_jobs\.id asc/
  )
  assert.match(migration, /for update skip locked/)
  assert.match(
    migration,
    /update public\.media_jobs[\s\S]*where id = v_job_id[\s\S]*and status = 'queued'/
  )
})

test('stale recovery uses minimal ownership fields and excludes healthy work', () => {
  for (const field of [
    'worker_claimed_at',
    'worker_heartbeat_at',
    'processing_attempt_count',
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${field}`))
  }
  assert.match(
    migration,
    /status in \('resolving', 'downloading', 'analyzing'\)/
  )
  assert.match(migration, /media_jobs\.worker_heartbeat_at/)
  assert.match(migration, /< v_stale_before/)
  assert.match(migration, /error_code = 'stale_job_timeout'/)
})

test('stale recovery preserves source metadata and finalizes events atomically', () => {
  const recovery = migration.split(
    'create or replace function public.recover_stale_media_jobs',
    2
  )[1]
  assert.ok(recovery)
  assert.doesNotMatch(recovery, /source_url\s*=/)
  assert.doesNotMatch(recovery, /source_metadata\s*=/)
  assert.doesNotMatch(recovery, /recipe_item_id\s*=/)
  assert.match(recovery, /'queue_job_stale_requeued'/)
  assert.match(recovery, /'queue_job_stale_failed'/)
  assert.match(recovery, /'ai_quota_reservation_released'/)
  assert.match(
    recovery,
    /grant execute on function public\.recover_stale_media_jobs\(integer, integer\) to service_role/
  )
})
