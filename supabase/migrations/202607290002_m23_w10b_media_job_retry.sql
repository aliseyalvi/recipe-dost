begin;

alter table public.media_jobs
  add column if not exists user_retry_count integer not null default 0,
  add column if not exists retry_requested_at timestamptz null;

alter table public.media_jobs
  drop constraint if exists media_jobs_user_retry_count_nonnegative;

alter table public.media_jobs
  add constraint media_jobs_user_retry_count_nonnegative
  check (user_retry_count >= 0);

create unique index if not exists media_job_retry_event_once_idx
  on public.media_job_events (
    media_job_id,
    event_type,
    (metadata ->> 'user_retry_count')
  )
  where event_type = 'media_job_retry_requested';

create or replace function public.retry_media_job(p_job_id uuid)
returns table (
  job_id uuid,
  status text,
  retry_accepted boolean,
  retry_count integer,
  retryable boolean,
  retry_block_reason text,
  next_state text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authenticated_user_id uuid := auth.uid();
  v_job public.media_jobs%rowtype;
  v_updated public.media_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_retry_reason text;
  v_is_stale_unlocked boolean := false;
begin
  if v_authenticated_user_id is null then
    job_id := p_job_id;
    status := null;
    retry_accepted := false;
    retry_count := 0;
    retryable := false;
    retry_block_reason := 'ownership_denied';
    next_state := null;
    return next;
    return;
  end if;

  select media_jobs.*
    into v_job
  from public.media_jobs
  where media_jobs.id = p_job_id
  for update;

  if not found then
    job_id := p_job_id;
    status := null;
    retry_accepted := false;
    retry_count := 0;
    retryable := false;
    retry_block_reason := 'job_not_found';
    next_state := null;
    return next;
    return;
  end if;

  job_id := v_job.id;

  if v_job.user_id <> v_authenticated_user_id then
    status := null;
    retry_accepted := false;
    retry_count := 0;
    retryable := false;
    retry_block_reason := 'ownership_denied';
    next_state := null;
    return next;
    return;
  end if;

  status := v_job.status;
  retry_count := v_job.user_retry_count;
  retry_accepted := false;
  retryable := false;
  next_state := v_job.status;

  if v_job.status = 'completed' then
    retry_block_reason := 'completed_job';
    return next;
    return;
  end if;

  if v_job.result_recipe_card_id is not null then
    retry_block_reason := 'result_already_exists';
    return next;
    return;
  end if;

  if v_job.status = 'queued' then
    if v_job.retry_requested_at is not null and v_job.user_retry_count > 0 then
      retryable := true;
      retry_block_reason := 'already_queued';
      next_state := 'queued';
    else
      retry_block_reason := 'active_job';
    end if;
    return next;
    return;
  end if;

  v_is_stale_unlocked :=
    v_job.status in ('resolving', 'downloading', 'analyzing')
    and v_job.worker_claimed_at is null
    and v_job.worker_heartbeat_at is null
    and coalesce(v_job.updated_at, v_job.started_at, v_job.created_at)
      < v_now - interval '10 minutes';

  if v_job.status in ('resolving', 'downloading', 'analyzing')
    and not v_is_stale_unlocked
  then
    retry_block_reason := 'active_job';
    return next;
    return;
  end if;

  if v_job.status = 'failed' then
    if v_job.error_code = 'video_duration_exceeded' then
      retry_block_reason := 'non_retryable_input';
      return next;
      return;
    end if;

    if v_job.error_code not in (
      'stale_job_timeout',
      'resolver_temporarily_unavailable',
      'gemini_rate_limited',
      'gemini_model_overloaded',
      'gemini_timeout',
      'gemini_server_error',
      'gemini_file_processing_timeout',
      'gemini_video_timeout',
      'gemini_text_timeout',
      'gemini_video_observation_timeout',
      'gemini_text_normalization_timeout'
    ) then
      retry_block_reason := 'non_retryable_input';
      return next;
      return;
    end if;
    v_retry_reason := 'recoverable_failure';
  elsif v_is_stale_unlocked then
    v_retry_reason := 'stale_job';
  else
    retry_block_reason := 'non_retryable_input';
    return next;
    return;
  end if;

  if v_job.user_retry_count >= 3 then
    retry_block_reason := 'retry_limit_reached';
    return next;
    return;
  end if;

  update public.media_jobs
  set status = 'queued',
      progress = 0,
      error_code = null,
      error_message = null,
      ai_provider = null,
      ai_model = null,
      raw_media_storage_path = null,
      gemini_file_name = null,
      started_at = null,
      completed_at = null,
      worker_claimed_at = null,
      worker_heartbeat_at = null,
      user_retry_count = v_job.user_retry_count + 1,
      retry_requested_at = v_now
  where media_jobs.id = v_job.id
  returning media_jobs.* into v_updated;

  insert into public.media_job_events (
    media_job_id,
    event_type,
    message,
    metadata
  )
  select
    v_updated.id,
    'ai_quota_reservation_released',
    'AI quota reservation released for user retry.',
    jsonb_build_object(
      'reason', 'user_retry_requested',
      'user_retry_count', v_updated.user_retry_count,
      'idempotent_replay', false
    )
  where exists (
    select 1
    from public.media_job_events
    where media_job_id = v_updated.id
      and event_type = 'ai_quota_reservation_created'
  )
  and not exists (
    select 1
    from public.media_job_events
    where media_job_id = v_updated.id
      and event_type = 'ai_quota_reservation_released'
  );

  insert into public.media_job_events (
    media_job_id,
    event_type,
    message,
    metadata
  )
  values (
    v_updated.id,
    'media_job_retry_requested',
    'User requested a media job retry.',
    jsonb_build_object(
      'status', 'queued',
      'user_retry_count', v_updated.user_retry_count,
      'retry_reason', v_retry_reason
    )
  );

  job_id := v_updated.id;
  status := v_updated.status;
  retry_accepted := true;
  retry_count := v_updated.user_retry_count;
  retryable := true;
  retry_block_reason := v_retry_reason;
  next_state := 'queued';
  return next;
end;
$$;

revoke all on function public.retry_media_job(uuid) from public;
revoke all on function public.retry_media_job(uuid) from anon;
grant execute on function public.retry_media_job(uuid) to authenticated;

commit;
