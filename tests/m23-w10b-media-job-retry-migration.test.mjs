import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202607290002_m23_w10b_media_job_retry.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();

const aiAccess = readFileSync(
  new URL("../supabase/functions/_shared/ai-access.ts", import.meta.url),
  "utf8",
).toLowerCase();

const rpc = migration.split(
  "create or replace function public.retry_media_job(p_job_id uuid)",
  2,
)[1];

assert.ok(rpc);

test("owner retry uses auth uid and one locked authoritative row", () => {
  assert.match(rpc, /v_authenticated_user_id uuid := auth\.uid\(\)/);
  assert.match(rpc, /where media_jobs\.id = p_job_id\s+for update/);
  assert.match(rpc, /v_job\.user_id <> v_authenticated_user_id/);
});

test("missing and foreign-owned jobs return bounded safe reasons", () => {
  assert.match(rpc, /if not found[\s\S]*'job_not_found'/);
  assert.match(
    rpc,
    /if v_job\.user_id <> v_authenticated_user_id[\s\S]*'ownership_denied'/,
  );
  const ownershipBlock = rpc.split(
    "if v_job.user_id <> v_authenticated_user_id",
    2,
  )[1].split("end if", 1)[0];
  assert.match(ownershipBlock, /status := null/);
  assert.match(ownershipBlock, /retry_count := 0/);
  assert.match(ownershipBlock, /next_state := null/);
});

test("anonymous execution is absent and broad execution is revoked", () => {
  assert.match(
    migration,
    /revoke all on function public\.retry_media_job\(uuid\) from public/,
  );
  assert.match(
    migration,
    /revoke all on function public\.retry_media_job\(uuid\) from anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.retry_media_job\(uuid\) to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.retry_media_job\(uuid\) to anon/,
  );
});

test("completed jobs are rejected before result reuse checks", () => {
  const completedAt = rpc.indexOf("v_job.status = 'completed'");
  const resultAt = rpc.indexOf("v_job.result_recipe_card_id is not null");
  assert.ok(completedAt >= 0);
  assert.ok(resultAt > completedAt);
  assert.match(rpc, /'completed_job'/);
});

test("any saved result is rejected", () => {
  assert.match(
    rpc,
    /v_job\.result_recipe_card_id is not null[\s\S]*'result_already_exists'/,
  );
});

test("healthy queued and actively leased jobs are rejected", () => {
  assert.match(rpc, /v_job\.status = 'queued'[\s\S]*'active_job'/);
  assert.match(
    rpc,
    /status in \('resolving', 'downloading', 'analyzing'\)[\s\S]*not v_is_stale_unlocked[\s\S]*'active_job'/,
  );
});

test("only stale unlocked active work can use the stale retry path", () => {
  assert.match(rpc, /v_job\.worker_claimed_at is null/);
  assert.match(rpc, /v_job\.worker_heartbeat_at is null/);
  assert.match(rpc, /< v_now - interval '10 minutes'/);
  assert.match(rpc, /v_retry_reason := 'stale_job'/);
});

test("three accepted user retries are the hard limit", () => {
  assert.match(
    migration,
    /add column if not exists user_retry_count integer not null default 0/,
  );
  assert.match(rpc, /if v_job\.user_retry_count >= 3/);
  assert.match(rpc, /'retry_limit_reached'/);
});

test("retry updates the same media job row and returns the same id", () => {
  assert.match(
    rpc,
    /update public\.media_jobs[\s\S]*where media_jobs\.id = v_job\.id/,
  );
  assert.match(rpc, /job_id := v_updated\.id/);
  assert.doesNotMatch(rpc, /insert into public\.media_jobs/);
});

test("source platform metadata duration and thumbnail fields are preserved", () => {
  const update = rpc.split("update public.media_jobs", 2)[1].split(
    "returning media_jobs.* into v_updated",
    1,
  )[0];
  for (
    const field of [
      "source_url",
      "platform",
      "source_mode",
      "source_metadata",
      "resolver_provider",
      "thumbnail_url",
      "media_duration_seconds",
      "media_size_bytes",
      "recipe_item_id",
    ]
  ) {
    assert.doesNotMatch(update, new RegExp(`${field}\\s*=`));
  }
});

test("retry clears only transient failure provider and lease fields", () => {
  for (
    const assignment of [
      "error_code = null",
      "error_message = null",
      "ai_provider = null",
      "ai_model = null",
      "raw_media_storage_path = null",
      "gemini_file_name = null",
      "started_at = null",
      "completed_at = null",
      "worker_claimed_at = null",
      "worker_heartbeat_at = null",
    ]
  ) {
    assert.match(rpc, new RegExp(assignment.replaceAll(" ", "\\s*")));
  }
  assert.match(rpc, /status = 'queued'/);
  assert.match(rpc, /progress = 0/);
});

test("duplicate retry is idempotent after the first call leaves queued state", () => {
  assert.match(
    rpc,
    /v_job\.retry_requested_at is not null and v_job\.user_retry_count > 0/,
  );
  assert.match(rpc, /retry_block_reason := 'already_queued'/);
  assert.match(rpc, /user_retry_count = v_job\.user_retry_count \+ 1/);
});

test("concurrent calls serialize and retry events have a per-count uniqueness fence", () => {
  assert.match(rpc, /for update/);
  assert.match(
    migration,
    /create unique index if not exists media_job_retry_event_once_idx/,
  );
  assert.match(
    migration,
    /where event_type = 'media_job_retry_requested'/,
  );
});

test("one safe retry event is inserted with no source or provider payload", () => {
  const eventInsert = rpc.split(
    "'media_job_retry_requested'",
    2,
  )[1];
  assert.match(eventInsert, /'user_retry_count'/);
  assert.match(eventInsert, /'retry_reason'/);
  for (
    const unsafe of [
      "source_url",
      "signed_url",
      "provider_response",
      "prompt",
      "filesystem",
    ]
  ) {
    assert.doesNotMatch(eventInsert, new RegExp(unsafe));
  }
});

test("remaining reservation release is idempotent and successful usage is untouched", () => {
  assert.match(rpc, /'ai_quota_reservation_released'/);
  assert.match(rpc, /event_type = 'ai_quota_reservation_created'/);
  assert.match(rpc, /event_type = 'ai_quota_reservation_released'/);
  assert.doesNotMatch(rpc, /update public\.usage_counters/);
  assert.doesNotMatch(rpc, /delete from public\.recipe_cards/);
  assert.doesNotMatch(rpc, /result_recipe_card_id\s*=/);
});

test("retried queued rows reserve zero until the normal W10A claim", () => {
  assert.match(
    aiAccess,
    /\.or\("status\.neq\.queued,retry_requested_at\.is\.null"\)/,
  );
  assert.match(
    readFileSync(
      new URL(
        "../supabase/migrations/202607290001_m23_w10a_queue_liveness.sql",
        import.meta.url,
      ),
      "utf8",
    ).toLowerCase(),
    /set status = 'resolving'/,
  );
});

test("duration failures and unknown errors remain non-retryable", () => {
  assert.match(
    rpc,
    /v_job\.error_code = 'video_duration_exceeded'[\s\S]*'non_retryable_input'/,
  );
  assert.match(
    rpc,
    /v_job\.error_code not in \([\s\S]*\)[\s\S]*'non_retryable_input'/,
  );
  assert.doesNotMatch(rpc, /'gemini_youtube_unavailable'/);
  assert.doesNotMatch(rpc, /'gemini_file_unavailable'/);
  assert.match(rpc, /'gemini_model_overloaded'/);
});

test("RPC response is bounded to the public retry contract", () => {
  for (
    const field of [
      "job_id uuid",
      "status text",
      "retry_accepted boolean",
      "retry_count integer",
      "retryable boolean",
      "retry_block_reason text",
      "next_state text",
    ]
  ) {
    assert.match(migration, new RegExp(field.replaceAll(" ", "\\s+")));
  }
});
