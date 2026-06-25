create table if not exists public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_item_id uuid,
  source_url text not null,
  platform text not null,
  status text not null default 'queued',
  source_mode text not null default 'unknown',
  resolver_provider text,
  ai_provider text,
  ai_model text,
  progress integer not null default 0,
  error_code text,
  error_message text,
  thumbnail_url text,
  raw_media_storage_path text,
  gemini_file_name text,
  media_duration_seconds integer,
  media_size_bytes bigint,
  result_recipe_card_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recipe_item_id, user_id)
    references public.recipe_items(id, user_id)
    on delete cascade,
  foreign key (result_recipe_card_id, user_id)
    references public.recipe_cards(id, user_id)
    on delete set null (result_recipe_card_id),
  constraint media_jobs_status_check check (
    status in (
      'queued',
      'resolving',
      'downloading',
      'validating',
      'thumbnailing',
      'uploading_to_ai',
      'analyzing',
      'saving_result',
      'completed',
      'failed',
      'needs_caption'
    )
  ),
  constraint media_jobs_source_mode_check check (
    source_mode in (
      'unknown',
      'text_only',
      'youtube_url',
      'uploaded_video',
      'unsupported_video_link'
    )
  ),
  constraint media_jobs_progress_check check (progress between 0 and 100),
  constraint media_jobs_duration_check check (
    media_duration_seconds is null or media_duration_seconds >= 0
  ),
  constraint media_jobs_size_check check (
    media_size_bytes is null or media_size_bytes >= 0
  )
);

create table if not exists public.media_job_events (
  id uuid primary key default gen_random_uuid(),
  media_job_id uuid not null references public.media_jobs(id) on delete cascade,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists media_jobs_user_id_idx
  on public.media_jobs (user_id);
create index if not exists media_jobs_recipe_item_id_idx
  on public.media_jobs (recipe_item_id);
create index if not exists media_jobs_user_recipe_created_at_idx
  on public.media_jobs (user_id, recipe_item_id, created_at desc);
create index if not exists media_jobs_status_idx
  on public.media_jobs (status);
create index if not exists media_jobs_created_at_idx
  on public.media_jobs (created_at desc);
create index if not exists media_jobs_expires_at_idx
  on public.media_jobs (expires_at);

create index if not exists media_job_events_media_job_id_idx
  on public.media_job_events (media_job_id);
create index if not exists media_job_events_job_created_at_idx
  on public.media_job_events (media_job_id, created_at desc);

drop trigger if exists set_media_jobs_updated_at on public.media_jobs;
create trigger set_media_jobs_updated_at
before update on public.media_jobs
for each row execute function public.set_updated_at();

alter table public.media_jobs enable row level security;
alter table public.media_job_events enable row level security;

revoke all on table public.media_jobs from anon, authenticated;
revoke all on table public.media_job_events from anon, authenticated;
grant select on table public.media_jobs to authenticated;
grant select on table public.media_job_events to authenticated;
grant all on table public.media_jobs to service_role;
grant all on table public.media_job_events to service_role;

drop policy if exists "Users can select own media_jobs" on public.media_jobs;
create policy "Users can select own media_jobs"
on public.media_jobs for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);

drop policy if exists "Users can select own media_job_events"
  on public.media_job_events;
create policy "Users can select own media_job_events"
on public.media_job_events for select
to authenticated
using (
  exists (
    select 1
    from public.media_jobs
    where media_jobs.id = media_job_events.media_job_id
      and (select auth.uid()) is not null
      and media_jobs.user_id = (select auth.uid())
  )
);
