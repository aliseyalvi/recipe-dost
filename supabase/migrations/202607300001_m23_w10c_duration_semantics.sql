begin;

alter table public.recipe_items
  add column if not exists source_video_duration_seconds integer null,
  add column if not exists recipe_prep_minutes integer null,
  add column if not exists recipe_cook_minutes integer null,
  add column if not exists recipe_total_minutes integer null,
  add column if not exists duration_semantics_version smallint not null default 1;

alter table public.recipe_items
  drop constraint if exists recipe_items_source_video_duration_bounds,
  drop constraint if exists recipe_items_recipe_prep_minutes_bounds,
  drop constraint if exists recipe_items_recipe_cook_minutes_bounds,
  drop constraint if exists recipe_items_recipe_total_minutes_bounds,
  drop constraint if exists recipe_items_duration_semantics_version_bounds;

alter table public.recipe_items
  add constraint recipe_items_source_video_duration_bounds
    check (
      source_video_duration_seconds is null
      or source_video_duration_seconds between 1 and 86400
    ),
  add constraint recipe_items_recipe_prep_minutes_bounds
    check (
      recipe_prep_minutes is null
      or recipe_prep_minutes between 1 and 10080
    ),
  add constraint recipe_items_recipe_cook_minutes_bounds
    check (
      recipe_cook_minutes is null
      or recipe_cook_minutes between 1 and 10080
    ),
  add constraint recipe_items_recipe_total_minutes_bounds
    check (
      recipe_total_minutes is null
      or recipe_total_minutes between 1 and 10080
    ),
  add constraint recipe_items_duration_semantics_version_bounds
    check (duration_semantics_version between 1 and 32767);

create or replace function public.duration_json_positive_minutes(
  p_time jsonb,
  p_primary_key text,
  p_alias_key text
)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_text text;
  v_value integer;
begin
  if jsonb_typeof(p_time) <> 'object' then
    return null;
  end if;

  v_text := coalesce(p_time ->> p_primary_key, p_time ->> p_alias_key);
  if v_text is null or v_text !~ '^[0-9]{1,5}$' then
    return null;
  end if;

  v_value := v_text::integer;
  if v_value < 1 or v_value > 10080 then
    return null;
  end if;
  return v_value;
end;
$$;

create or replace function public.sync_recipe_item_duration_semantics()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prep integer;
  v_cook integer;
  v_total integer;
begin
  v_prep := public.duration_json_positive_minutes(
    new.time_json,
    'prep_minutes',
    'prep_time_minutes'
  );
  v_cook := public.duration_json_positive_minutes(
    new.time_json,
    'cook_minutes',
    'cook_time_minutes'
  );
  v_total := public.duration_json_positive_minutes(
    new.time_json,
    'total_minutes',
    'time_minutes'
  );

  if v_total is null
    and v_prep is not null
    and v_cook is not null
    and v_prep + v_cook <= 10080
  then
    v_total := v_prep + v_cook;
  end if;

  update public.recipe_items
  set recipe_prep_minutes = v_prep,
      recipe_cook_minutes = v_cook,
      recipe_total_minutes = v_total,
      duration_seconds = (
        case when v_total is null then null else v_total * 60 end
      ),
      duration_semantics_version = 1
  where recipe_items.id = new.recipe_id
    and recipe_items.user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists sync_recipe_item_duration_semantics
  on public.recipe_cards;
create trigger sync_recipe_item_duration_semantics
after insert or update of time_json on public.recipe_cards
for each row execute function public.sync_recipe_item_duration_semantics();

create or replace function public.sync_media_job_source_video_duration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.recipe_item_id is not null
    and new.media_duration_seconds between 1 and 86400
  then
    update public.recipe_items
    set source_video_duration_seconds = new.media_duration_seconds,
        duration_semantics_version = 1
    where recipe_items.id = new.recipe_item_id
      and recipe_items.user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_media_job_source_video_duration
  on public.media_jobs;
create trigger sync_media_job_source_video_duration
after insert or update of media_duration_seconds, recipe_item_id
on public.media_jobs
for each row execute function public.sync_media_job_source_video_duration();

with selected_card as (
  select distinct on (recipe_cards.recipe_id, recipe_cards.user_id)
    recipe_cards.recipe_id,
    recipe_cards.user_id,
    recipe_cards.time_json
  from public.recipe_cards
  order by
    recipe_cards.recipe_id,
    recipe_cards.user_id,
    recipe_cards.updated_at desc,
    recipe_cards.created_at desc,
    recipe_cards.id desc
),
normalized as (
  select
    selected_card.recipe_id,
    selected_card.user_id,
    public.duration_json_positive_minutes(
      selected_card.time_json,
      'prep_minutes',
      'prep_time_minutes'
    ) as prep_minutes,
    public.duration_json_positive_minutes(
      selected_card.time_json,
      'cook_minutes',
      'cook_time_minutes'
    ) as cook_minutes,
    public.duration_json_positive_minutes(
      selected_card.time_json,
      'total_minutes',
      'time_minutes'
    ) as explicit_total_minutes
  from selected_card
),
derived as (
  select
    normalized.recipe_id,
    normalized.user_id,
    normalized.prep_minutes,
    normalized.cook_minutes,
    case
      when normalized.explicit_total_minutes is not null
        then normalized.explicit_total_minutes
      when normalized.prep_minutes is not null
        and normalized.cook_minutes is not null
        and normalized.prep_minutes + normalized.cook_minutes <= 10080
        then normalized.prep_minutes + normalized.cook_minutes
      else null
    end as total_minutes
  from normalized
)
update public.recipe_items
set recipe_prep_minutes = derived.prep_minutes,
    recipe_cook_minutes = derived.cook_minutes,
    recipe_total_minutes = derived.total_minutes,
    duration_seconds = (
      case
        when derived.total_minutes is null then null
        else derived.total_minutes * 60
      end
    ),
    duration_semantics_version = 1
from derived
where recipe_items.id = derived.recipe_id
  and recipe_items.user_id = derived.user_id;

update public.recipe_items
set duration_seconds = null,
    duration_semantics_version = 1
where recipe_total_minutes is null;

with latest_job_duration as (
  select distinct on (media_jobs.recipe_item_id, media_jobs.user_id)
    media_jobs.recipe_item_id,
    media_jobs.user_id,
    media_jobs.media_duration_seconds
  from public.media_jobs
  where media_jobs.recipe_item_id is not null
    and media_jobs.media_duration_seconds between 1 and 86400
  order by
    media_jobs.recipe_item_id,
    media_jobs.user_id,
    media_jobs.updated_at desc,
    media_jobs.created_at desc,
    media_jobs.id desc
)
update public.recipe_items
set source_video_duration_seconds =
      latest_job_duration.media_duration_seconds,
    duration_semantics_version = 1
from latest_job_duration
where recipe_items.id = latest_job_duration.recipe_item_id
  and recipe_items.user_id = latest_job_duration.user_id;

update public.recipe_items
set source_video_duration_seconds = case
      when source_metadata ->> 'duration_seconds' ~ '^[0-9]{1,5}$'
        then (source_metadata ->> 'duration_seconds')::integer
      else null
    end,
    duration_semantics_version = 1
where source_video_duration_seconds is null
  and source_metadata ->> 'duration_validation_source' in (
    'ffprobe',
    'validated_resolver_metadata',
    'trusted_source_metadata',
    'youtube_metadata'
  )
  and source_metadata ->> 'duration_seconds' ~ '^[0-9]{1,5}$'
  and (
    case
      when source_metadata ->> 'duration_seconds' ~ '^[0-9]{1,5}$'
        then (source_metadata ->> 'duration_seconds')::integer
      else null
    end
  ) between 1 and 86400;

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
  v_source_duration_seconds integer;
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
      if v_job.media_duration_seconds between 1 and 86400 then
        v_source_duration_seconds := v_job.media_duration_seconds;
      else
        select
          case
            when coalesce(
              media_job_events.metadata ->> 'actual_duration_seconds',
              media_job_events.metadata ->> 'duration_seconds'
            ) ~ '^[0-9]{1,5}$'
            then coalesce(
              media_job_events.metadata ->> 'actual_duration_seconds',
              media_job_events.metadata ->> 'duration_seconds'
            )::integer
            else null
          end
          into v_source_duration_seconds
        from public.media_job_events
        where media_job_events.media_job_id = v_job.id
          and media_job_events.event_type in (
            'unified_extractor_failed',
            'video_too_long',
            'queue_job_failed'
          )
          and (
            media_job_events.event_type in (
              'unified_extractor_failed',
              'video_too_long'
            )
            or media_job_events.metadata ->> 'duration_validation_source' in (
              'ffprobe',
              'validated_resolver_metadata',
              'trusted_source_metadata',
              'youtube_metadata'
            )
          )
        order by media_job_events.created_at desc, media_job_events.id desc
        limit 1;
      end if;

      if v_source_duration_seconds is null
        or v_source_duration_seconds < 1
        or v_source_duration_seconds > 180
      then
        retry_block_reason := 'non_retryable_input';
        return next;
        return;
      end if;
      v_retry_reason := 'recoverable_failure';
    elsif v_job.error_code in (
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
      v_retry_reason := 'recoverable_failure';
    else
      retry_block_reason := 'non_retryable_input';
      return next;
      return;
    end if;
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

revoke all on function public.duration_json_positive_minutes(jsonb, text, text)
  from public;
revoke all on function public.sync_recipe_item_duration_semantics()
  from public;
revoke all on function public.sync_media_job_source_video_duration()
  from public;
revoke all on function public.retry_media_job(uuid) from public;
revoke all on function public.retry_media_job(uuid) from anon;
grant execute on function public.retry_media_job(uuid) to authenticated;

commit;
