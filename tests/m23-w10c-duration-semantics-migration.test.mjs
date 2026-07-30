import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202607300001_m23_w10c_duration_semantics.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();

const createMediaJob = readFileSync(
  new URL("../supabase/functions/create-media-job/index.ts", import.meta.url),
  "utf8",
);

const refreshMetadata = readFileSync(
  new URL(
    "../supabase/functions/refresh-recipe-metadata/index.ts",
    import.meta.url,
  ),
  "utf8",
);

const retryRpc = migration.split(
  "create or replace function public.retry_media_job(p_job_id uuid)",
  2,
)[1];

assert.ok(retryRpc);

test("one additive migration adds only the explicit recipe item duration fields", () => {
  for (
    const field of [
      "source_video_duration_seconds integer null",
      "recipe_prep_minutes integer null",
      "recipe_cook_minutes integer null",
      "recipe_total_minutes integer null",
      "duration_semantics_version smallint not null default 1",
    ]
  ) {
    assert.match(migration, new RegExp(field.replaceAll(" ", "\\s+")));
  }
  assert.doesNotMatch(
    migration,
    /alter table public\.media_jobs[\s\S]{0,300}add column/,
  );
});

test("duration constraints require positive conservative values", () => {
  assert.match(
    migration,
    /source_video_duration_seconds between 1 and 86400/,
  );
  for (
    const field of [
      "recipe_prep_minutes",
      "recipe_cook_minutes",
      "recipe_total_minutes",
    ]
  ) {
    assert.match(
      migration,
      new RegExp(`${field}[\\s\\S]{0,80}between 1 and 10080`),
    );
  }
  assert.match(migration, /duration_semantics_version between 1 and 32767/);
});

test("recipe total preserves explicit total then derives only from prep plus cook", () => {
  const trigger = migration.split(
    "create or replace function public.sync_recipe_item_duration_semantics()",
    2,
  )[1].split("$$;", 1)[0];
  assert.match(trigger, /'total_minutes',\s*'time_minutes'/);
  assert.match(
    trigger,
    /v_total is null[\s\S]*v_prep is not null[\s\S]*v_cook is not null[\s\S]*v_total := v_prep \+ v_cook/,
  );
  assert.doesNotMatch(trigger, /coalesce\(v_prep,\s*0\)/);
  assert.doesNotMatch(trigger, /coalesce\(v_cook,\s*0\)/);
});

test("legacy library duration is populated only from recipe total minutes", () => {
  assert.match(
    migration,
    /duration_seconds = \([\s\S]*when v_total is null then null[\s\S]*v_total \* 60/,
  );
  assert.match(
    migration,
    /update public\.recipe_items\s+set duration_seconds = null[\s\S]*where recipe_total_minutes is null/,
  );
  assert.doesNotMatch(
    migration,
    /duration_seconds\s*=\s*source_video_duration_seconds/,
  );
});

test("source duration synchronizes only from authoritative worker or marked metadata", () => {
  assert.match(
    migration,
    /sync_media_job_source_video_duration[\s\S]*new\.media_duration_seconds between 1 and 86400/,
  );
  assert.match(
    migration,
    /latest_job_duration[\s\S]*media_jobs\.media_duration_seconds between 1 and 86400/,
  );
  for (
    const source of [
      "ffprobe",
      "validated_resolver_metadata",
      "trusted_source_metadata",
      "youtube_metadata",
    ]
  ) {
    assert.match(migration, new RegExp(`'${source}'`));
  }
  assert.doesNotMatch(
    migration,
    /source_video_duration_seconds\s*=\s*recipe_total_minutes/,
  );
});

test("duration retry trusts locked server state and accepts only 1 through 180", () => {
  assert.match(retryRpc, /where media_jobs\.id = p_job_id\s+for update/);
  assert.match(
    retryRpc,
    /v_job\.error_code = 'video_duration_exceeded'/,
  );
  assert.match(
    retryRpc,
    /v_job\.media_duration_seconds between 1 and 86400/,
  );
  assert.match(
    retryRpc,
    /v_source_duration_seconds > 180[\s\S]*'non_retryable_input'/,
  );
  assert.match(retryRpc, /v_retry_reason := 'recoverable_failure'/);
  assert.doesNotMatch(retryRpc, /p_max_duration/);
  assert.doesNotMatch(retryRpc, /p_actual_duration/);
});

test("duration retry can use only server-written authoritative event families", () => {
  for (
    const eventType of [
      "unified_extractor_failed",
      "video_too_long",
      "queue_job_failed",
    ]
  ) {
    assert.match(retryRpc, new RegExp(`'${eventType}'`));
  }
  assert.match(retryRpc, /order by media_job_events\.created_at desc/);
  assert.match(retryRpc, /limit 1/);
});

test("W10B atomic idempotent and authorization behavior remains in replacement RPC", () => {
  assert.match(retryRpc, /v_authenticated_user_id uuid := auth\.uid\(\)/);
  assert.match(retryRpc, /v_job\.user_id <> v_authenticated_user_id/);
  assert.match(retryRpc, /v_job\.user_retry_count >= 3/);
  assert.match(retryRpc, /retry_block_reason := 'already_queued'/);
  assert.match(retryRpc, /user_retry_count = v_job\.user_retry_count \+ 1/);
  assert.match(retryRpc, /'media_job_retry_requested'/);
  assert.match(retryRpc, /'ai_quota_reservation_released'/);
  assert.match(
    migration,
    /revoke all on function public\.retry_media_job\(uuid\) from anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.retry_media_job\(uuid\) to authenticated/,
  );
});

test("create-media-job no longer owns a competing hardcoded duration policy", () => {
  assert.doesNotMatch(createMediaJob, /MAX_AI_VIDEO_DURATION_SECONDS/);
  assert.doesNotMatch(createMediaJob, /isRecipeTooLong/);
  assert.doesNotMatch(createMediaJob, /longer than 2 minutes/i);
});

test("metadata refresh writes source duration separately and preserves legacy recipe duration", () => {
  assert.match(
    refreshMetadata,
    /source_video_duration_seconds:\s*workerResult\.metadata\.durationSeconds/,
  );
  assert.doesNotMatch(
    refreshMetadata,
    /\n\s+duration_seconds:\s*workerResult\.metadata\.durationSeconds/,
  );
  assert.match(
    refreshMetadata,
    /duration_validation_source:\s*metadata\.durationValidationSource/,
  );
});
