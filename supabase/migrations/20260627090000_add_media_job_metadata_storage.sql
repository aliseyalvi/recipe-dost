alter table public.media_jobs
add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.media_job_private_metadata (
  id uuid primary key default gen_random_uuid(),
  media_job_id uuid not null unique references public.media_jobs(id) on delete cascade,
  platform text,
  resolver text,
  cdn_url text,
  cdn_url_expires_at timestamptz,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_job_private_metadata_media_job_id_idx
on public.media_job_private_metadata(media_job_id);

drop trigger if exists set_media_job_private_metadata_updated_at
  on public.media_job_private_metadata;
create trigger set_media_job_private_metadata_updated_at
before update on public.media_job_private_metadata
for each row execute function public.set_updated_at();

alter table public.media_job_private_metadata enable row level security;

revoke all on table public.media_job_private_metadata from anon, authenticated;
grant all on table public.media_job_private_metadata to service_role;
