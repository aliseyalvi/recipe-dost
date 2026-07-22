import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20260722105123_m24_1_revenuecat_binding_and_sync_state.sql',
    import.meta.url
  ),
  'utf8'
)
const syncIndex = readFileSync(
  new URL('../supabase/functions/sync-revenuecat-entitlement/index.ts', import.meta.url),
  'utf8'
)
const syncService = readFileSync(
  new URL('../supabase/functions/sync-revenuecat-entitlement/service.ts', import.meta.url),
  'utf8'
)
const createMediaJob = readFileSync(
  new URL('../supabase/functions/create-media-job/index.ts', import.meta.url),
  'utf8'
)
const secretSync = readFileSync(
  new URL('../scripts/env/sync-supabase-secrets.mjs', import.meta.url),
  'utf8'
)

test('binding and sync-state tables are additive, unique, and service-only', () => {
  assert.match(migration, /create table public\.revenuecat_customer_bindings/)
  assert.match(migration, /create table public\.revenuecat_sync_state/)
  assert.match(migration, /unique \(environment, revenuecat_customer_key\)/)
  assert.match(migration, /unique \(environment, supabase_user_id\)/)
  assert.match(migration, /references auth\.users\(id\) on delete cascade/)
  assert.match(migration, /alter table public\.revenuecat_customer_bindings enable row level security/)
  assert.match(migration, /alter table public\.revenuecat_sync_state enable row level security/)
  assert.match(
    migration,
    /revoke all on table public\.revenuecat_customer_bindings from public, anon, authenticated/
  )
  assert.doesNotMatch(migration, /create policy/i)
})

test('lease acquisition is atomic, bounded, and recoverable after expiry', () => {
  assert.match(migration, /create or replace function public\.acquire_revenuecat_sync_lease/)
  assert.match(migration, /p_lease_seconds integer default 20/)
  assert.match(migration, /on conflict \(environment, supabase_user_id\)/)
  assert.match(migration, /sync_in_progress_until <= now\(\)/)
  assert.match(migration, /create or replace function public\.complete_revenuecat_sync_lease/)
  assert.match(migration, /sync_in_progress_until = null/)
  assert.match(
    migration,
    /grant execute on function public\.acquire_revenuecat_sync_lease[\s\S]*to service_role/
  )
})

test('binding and projection operations are race-safe service-role RPCs', () => {
  assert.match(migration, /create or replace function public\.bind_revenuecat_customer/)
  assert.match(migration, /on conflict do nothing/)
  assert.match(migration, /return 'conflict'/)
  assert.match(
    migration,
    /create or replace function public\.persist_revenuecat_entitlement_projection/
  )
  assert.match(migration, /p_supabase_user_id::text/)
  assert.match(migration, /last_entitlement_active = p_entitlement_active/)
  assert.match(migration, /security invoker/g)
})

test('sync remains bearer-derived, no-body compatible, and additive', () => {
  assert.match(syncIndex, /auth\.getUser\(\)/)
  assert.doesNotMatch(syncIndex, /body\.(?:user|user_id|supabase_user_id|target_user_id)/)
  assert.match(syncService, /if \(!rawBody\.trim\(\)\) return \{ ok: true, trigger: "unknown" \}/)
  for (const field of [
    'revenuecat_entitlement_active',
    'revenuecat_entitlement',
    'revenuecat_product_id',
    'revenuecat_expires_at',
    'revenuecat_updated_at',
  ]) {
    assert.match(syncIndex, new RegExp(field))
  }
  assert.match(syncIndex, /sync_status/)
  assert.match(syncIndex, /error: \{ code, message \}/)
})

test('provider transport is bounded and never logs the subscriber request URL', () => {
  assert.match(syncService, /timeoutMs = 8_000/)
  assert.match(syncService, /maxAttempts = 2/)
  assert.match(syncService, /new AbortController\(\)/)
  assert.match(syncService, /response\.status >= 500/)
  assert.doesNotMatch(syncService, /console\.(?:log|error|warn)/)
  assert.doesNotMatch(syncIndex, /console\.(?:log|error|warn)\([^\n]*user\.id/)
})

test('required HMAC secret is allowlisted for manual Supabase sync', () => {
  assert.match(secretSync, /"REVENUECAT_BINDING_HMAC_SECRET"/)
  assert.match(secretSync, /"SUPABASE_ENV_NAME"/)
})

test('create-media-job remains authoritative before inserting a media job', () => {
  const accessIndex = createMediaJob.indexOf('getAiGenerationAccess(clients.adminClient, user.id)')
  const insertIndex = createMediaJob.indexOf('.from("media_jobs")', accessIndex)
  assert.ok(accessIndex >= 0)
  assert.ok(insertIndex > accessIndex)
  assert.match(createMediaJob, /if \(!access\.allowed\)/)
})
