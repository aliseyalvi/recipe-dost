begin;

alter table public.media_jobs
  add column if not exists worker_claimed_at timestamptz null,
  add column if not exists worker_heartbeat_at timestamptz null,
  add column if not exists processing_attempt_count integer not null default 0;

alter table public.media_jobs
  drop constraint if exists media_jobs_processing_attempt_count_nonnegative;

alter table public.media_jobs
  add constraint media_jobs_processing_attempt_count_nonnegative
  check (processing_attempt_count >= 0);

create index if not exists media_jobs_queue_fifo_idx
  on public.media_jobs (created_at asc, id asc)
  where status = 'queued';

create or replace function public.claim_oldest_media_job()
returns setof public.media_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  select media_jobs.id
    into v_job_id
  from public.media_jobs
  where media_jobs.status = 'queued'
  order by media_jobs.created_at asc, media_jobs.id asc
  for update skip locked
  limit 1;

  if v_job_id is null then
    return;
  end if;

  return query
  update public.media_jobs
  set status = 'resolving',
      progress = 20,
      error_code = null,
      error_message = null,
      started_at = coalesce(started_at, v_now),
      worker_claimed_at = v_now,
      worker_heartbeat_at = v_now
  where id = v_job_id
    and status = 'queued'
  returning media_jobs.*;
end;
$$;

create or replace function public.recover_stale_media_jobs(
  p_stale_after_seconds integer,
  p_max_recovery_attempts integer
)
returns table (
  job jsonb,
  recovery_action text,
  processing_attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.media_jobs%rowtype;
  v_updated public.media_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_stale_before timestamptz;
begin
  if p_stale_after_seconds < 60 or p_stale_after_seconds > 86400 then
    raise exception 'p_stale_after_seconds is outside safe bounds';
  end if;
  if p_max_recovery_attempts < 1 or p_max_recovery_attempts > 10 then
    raise exception 'p_max_recovery_attempts is outside safe bounds';
  end if;

  v_stale_before := v_now - make_interval(secs => p_stale_after_seconds);

  for v_job in
    select media_jobs.*
    from public.media_jobs
    where media_jobs.status in ('resolving', 'downloading', 'analyzing')
      and coalesce(
        media_jobs.worker_heartbeat_at,
        media_jobs.updated_at,
        media_jobs.worker_claimed_at,
        media_jobs.started_at,
        media_jobs.created_at
      ) < v_stale_before
    order by media_jobs.created_at asc, media_jobs.id asc
    for update skip locked
  loop
    if v_job.processing_attempt_count < p_max_recovery_attempts then
      update public.media_jobs
      set status = 'queued',
          progress = 0,
          error_code = null,
          error_message = null,
          completed_at = null,
          started_at = null,
          worker_claimed_at = null,
          worker_heartbeat_at = null,
          processing_attempt_count = v_job.processing_attempt_count + 1
      where id = v_job.id
        and status in ('resolving', 'downloading', 'analyzing')
      returning media_jobs.* into v_updated;

      if found then
        insert into public.media_job_events (
          media_job_id,
          event_type,
          message,
          metadata
        )
        values (
          v_updated.id,
          'queue_job_stale_requeued',
          'Stale queue job was safely requeued.',
          jsonb_build_object(
            'status', 'queued',
            'processing_attempt_count', v_updated.processing_attempt_count
          )
        );

        insert into public.media_job_events (
          media_job_id,
          event_type,
          message,
          metadata
        )
        select
          v_updated.id,
          'ai_quota_reservation_released',
          'AI quota reservation released for stale recovery.',
          jsonb_build_object(
            'reason', 'stale_job_requeued',
            'processing_attempt_count', v_updated.processing_attempt_count,
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

        job := to_jsonb(v_updated);
        recovery_action := 'requeued';
        processing_attempt_count := v_updated.processing_attempt_count;
        return next;
      end if;
    else
      update public.media_jobs
      set status = 'failed',
          progress = 100,
          error_code = 'stale_job_timeout',
          error_message = 'This recipe took too long to process. Please try again.',
          completed_at = v_now,
          worker_claimed_at = null,
          worker_heartbeat_at = null
      where id = v_job.id
        and status in ('resolving', 'downloading', 'analyzing')
      returning media_jobs.* into v_updated;

      if found then
        insert into public.media_job_events (
          media_job_id,
          event_type,
          message,
          metadata
        )
        values (
          v_updated.id,
          'queue_job_stale_failed',
          'Stale queue job reached its recovery limit.',
          jsonb_build_object(
            'status', 'failed',
            'error_code', 'stale_job_timeout',
            'processing_attempt_count', v_updated.processing_attempt_count
          )
        );

        insert into public.media_job_events (
          media_job_id,
          event_type,
          message,
          metadata
        )
        select
          v_updated.id,
          'ai_quota_reservation_released',
          'AI quota reservation released for stale recovery.',
          jsonb_build_object(
            'reason', 'stale_job_failed',
            'processing_attempt_count', v_updated.processing_attempt_count,
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

        job := to_jsonb(v_updated);
        recovery_action := 'failed';
        processing_attempt_count := v_updated.processing_attempt_count;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.claim_oldest_media_job() from public;
revoke all on function public.recover_stale_media_jobs(integer, integer) from public;
grant execute on function public.claim_oldest_media_job() to service_role;
grant execute on function public.recover_stale_media_jobs(integer, integer) to service_role;

commit;
