create table if not exists public.ai_content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_card_id uuid not null references public.recipe_cards(id) on delete cascade,
  category text not null check (
    category in (
      'incorrect_or_misleading',
      'unsafe_cooking_instructions',
      'allergy_or_food_safety',
      'offensive_content',
      'other'
    )
  ),
  note text check (note is null or char_length(note) <= 500),
  app_version text,
  build_number text,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_card_id, category)
);

create index if not exists ai_content_reports_user_id_idx
  on public.ai_content_reports (user_id);
create index if not exists ai_content_reports_created_at_idx
  on public.ai_content_reports (created_at desc);

alter table public.ai_content_reports enable row level security;

revoke all on table public.ai_content_reports from anon, authenticated;

comment on table public.ai_content_reports is
  'Privacy-minimized reports about AI-generated recipe cards. Writes are accepted only through the authenticated submit-ai-report Edge Function.';
