create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text,
  household_size text,
  cooking_level text,
  cuisine_preference text,
  main_use text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  platform text,
  title text,
  description text,
  thumbnail_url text,
  user_note text,
  pasted_caption text,
  manual_ingredients text,
  meal_type text,
  cuisine text,
  metadata_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.recipe_cards (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_title text,
  short_summary text,
  ingredients_json jsonb not null default '[]'::jsonb,
  steps_json jsonb not null default '[]'::jsonb,
  time_json jsonb not null default '{}'::jsonb,
  servings text,
  difficulty text,
  grocery_list_json jsonb not null default '[]'::jsonb,
  tags_json jsonb not null default '[]'::jsonb,
  substitutions_json jsonb not null default '[]'::jsonb,
  storage_tip text,
  safety_note text,
  confidence text,
  missing_info_json jsonb not null default '[]'::jsonb,
  source_link text,
  model_used text,
  prompt_version text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recipe_id, user_id) references public.recipe_items(id, user_id) on delete cascade,
  unique (id, user_id)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null,
  recipe_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (collection_id, user_id) references public.collections(id, user_id) on delete cascade,
  foreign key (recipe_id, user_id) references public.recipe_items(id, user_id) on delete cascade,
  unique (collection_id, recipe_id)
);

create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  items_json jsonb not null default '[]'::jsonb,
  source_recipe_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  recipe_cards_used integer not null default 0,
  grocery_lists_used integer not null default 0,
  saved_links_used integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revenuecat_app_user_id text,
  entitlement text not null default 'free',
  status text not null default 'none',
  product_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metadata_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text,
  status text not null,
  error_code text,
  fetched_at timestamptz not null default now(),
  foreign key (recipe_id, user_id) references public.recipe_items(id, user_id) on delete cascade
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_type text,
  message text not null,
  app_version text,
  platform text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_updated_at_idx on public.user_profiles (updated_at);

create index if not exists recipe_items_user_id_idx on public.recipe_items (user_id);
create index if not exists recipe_items_created_at_idx on public.recipe_items (created_at desc);
create index if not exists recipe_items_user_created_at_idx on public.recipe_items (user_id, created_at desc);
create index if not exists recipe_items_metadata_status_idx on public.recipe_items (metadata_status);
create index if not exists recipe_items_platform_idx on public.recipe_items (platform);

create index if not exists recipe_cards_user_id_idx on public.recipe_cards (user_id);
create index if not exists recipe_cards_recipe_id_idx on public.recipe_cards (recipe_id);
create index if not exists recipe_cards_created_at_idx on public.recipe_cards (created_at desc);
create index if not exists recipe_cards_user_created_at_idx on public.recipe_cards (user_id, created_at desc);
create index if not exists recipe_cards_confidence_idx on public.recipe_cards (confidence);

create index if not exists collections_user_id_idx on public.collections (user_id);
create index if not exists collections_created_at_idx on public.collections (created_at desc);
create index if not exists collections_type_idx on public.collections (type);

create index if not exists collection_items_user_id_idx on public.collection_items (user_id);
create index if not exists collection_items_collection_id_idx on public.collection_items (collection_id);
create index if not exists collection_items_recipe_id_idx on public.collection_items (recipe_id);
create index if not exists collection_items_created_at_idx on public.collection_items (created_at desc);

create index if not exists grocery_lists_user_id_idx on public.grocery_lists (user_id);
create index if not exists grocery_lists_created_at_idx on public.grocery_lists (created_at desc);
create index if not exists grocery_lists_user_created_at_idx on public.grocery_lists (user_id, created_at desc);

create index if not exists usage_counters_user_id_idx on public.usage_counters (user_id);
create index if not exists usage_counters_period_idx on public.usage_counters (period);
create index if not exists usage_counters_user_period_idx on public.usage_counters (user_id, period);

create index if not exists subscriptions_revenuecat_app_user_id_idx on public.subscriptions (revenuecat_app_user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_entitlement_idx on public.subscriptions (entitlement);
create index if not exists subscriptions_expires_at_idx on public.subscriptions (expires_at);

create index if not exists metadata_fetch_logs_user_id_idx on public.metadata_fetch_logs (user_id);
create index if not exists metadata_fetch_logs_recipe_id_idx on public.metadata_fetch_logs (recipe_id);
create index if not exists metadata_fetch_logs_status_idx on public.metadata_fetch_logs (status);
create index if not exists metadata_fetch_logs_fetched_at_idx on public.metadata_fetch_logs (fetched_at desc);

create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_created_at_idx on public.support_tickets (created_at desc);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_recipe_items_updated_at on public.recipe_items;
create trigger set_recipe_items_updated_at
before update on public.recipe_items
for each row execute function public.set_updated_at();

drop trigger if exists set_recipe_cards_updated_at on public.recipe_cards;
create trigger set_recipe_cards_updated_at
before update on public.recipe_cards
for each row execute function public.set_updated_at();

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists set_grocery_lists_updated_at on public.grocery_lists;
create trigger set_grocery_lists_updated_at
before update on public.grocery_lists
for each row execute function public.set_updated_at();

drop trigger if exists set_usage_counters_updated_at on public.usage_counters;
create trigger set_usage_counters_updated_at
before update on public.usage_counters
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.recipe_items enable row level security;
alter table public.recipe_cards enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.grocery_lists enable row level security;
alter table public.usage_counters enable row level security;
alter table public.subscriptions enable row level security;
alter table public.metadata_fetch_logs enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "Users can select own user_profiles" on public.user_profiles;
create policy "Users can select own user_profiles"
on public.user_profiles for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own user_profiles" on public.user_profiles;
create policy "Users can insert own user_profiles"
on public.user_profiles for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own user_profiles" on public.user_profiles;
create policy "Users can update own user_profiles"
on public.user_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own user_profiles" on public.user_profiles;
create policy "Users can delete own user_profiles"
on public.user_profiles for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own recipe_items" on public.recipe_items;
create policy "Users can select own recipe_items"
on public.recipe_items for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own recipe_items" on public.recipe_items;
create policy "Users can insert own recipe_items"
on public.recipe_items for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own recipe_items" on public.recipe_items;
create policy "Users can update own recipe_items"
on public.recipe_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recipe_items" on public.recipe_items;
create policy "Users can delete own recipe_items"
on public.recipe_items for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own recipe_cards" on public.recipe_cards;
create policy "Users can select own recipe_cards"
on public.recipe_cards for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own recipe_cards" on public.recipe_cards;
create policy "Users can insert own recipe_cards"
on public.recipe_cards for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own recipe_cards" on public.recipe_cards;
create policy "Users can update own recipe_cards"
on public.recipe_cards for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recipe_cards" on public.recipe_cards;
create policy "Users can delete own recipe_cards"
on public.recipe_cards for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own collections" on public.collections;
create policy "Users can select own collections"
on public.collections for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own collections" on public.collections;
create policy "Users can insert own collections"
on public.collections for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own collections" on public.collections;
create policy "Users can update own collections"
on public.collections for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own collections" on public.collections;
create policy "Users can delete own collections"
on public.collections for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own collection_items" on public.collection_items;
create policy "Users can select own collection_items"
on public.collection_items for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own collection_items" on public.collection_items;
create policy "Users can insert own collection_items"
on public.collection_items for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own collection_items" on public.collection_items;
create policy "Users can update own collection_items"
on public.collection_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own collection_items" on public.collection_items;
create policy "Users can delete own collection_items"
on public.collection_items for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own grocery_lists" on public.grocery_lists;
create policy "Users can select own grocery_lists"
on public.grocery_lists for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own grocery_lists" on public.grocery_lists;
create policy "Users can insert own grocery_lists"
on public.grocery_lists for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own grocery_lists" on public.grocery_lists;
create policy "Users can update own grocery_lists"
on public.grocery_lists for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own grocery_lists" on public.grocery_lists;
create policy "Users can delete own grocery_lists"
on public.grocery_lists for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own usage_counters" on public.usage_counters;
create policy "Users can select own usage_counters"
on public.usage_counters for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage_counters" on public.usage_counters;
create policy "Users can insert own usage_counters"
on public.usage_counters for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage_counters" on public.usage_counters;
create policy "Users can update own usage_counters"
on public.usage_counters for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own usage_counters" on public.usage_counters;
create policy "Users can delete own usage_counters"
on public.usage_counters for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own subscriptions" on public.subscriptions;
create policy "Users can select own subscriptions"
on public.subscriptions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own subscriptions" on public.subscriptions;
create policy "Users can insert own subscriptions"
on public.subscriptions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own subscriptions" on public.subscriptions;
create policy "Users can update own subscriptions"
on public.subscriptions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own subscriptions" on public.subscriptions;
create policy "Users can delete own subscriptions"
on public.subscriptions for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own metadata_fetch_logs" on public.metadata_fetch_logs;
create policy "Users can select own metadata_fetch_logs"
on public.metadata_fetch_logs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own metadata_fetch_logs" on public.metadata_fetch_logs;
create policy "Users can insert own metadata_fetch_logs"
on public.metadata_fetch_logs for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own metadata_fetch_logs" on public.metadata_fetch_logs;
create policy "Users can update own metadata_fetch_logs"
on public.metadata_fetch_logs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own metadata_fetch_logs" on public.metadata_fetch_logs;
create policy "Users can delete own metadata_fetch_logs"
on public.metadata_fetch_logs for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own support_tickets" on public.support_tickets;
create policy "Users can select own support_tickets"
on public.support_tickets for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own support_tickets" on public.support_tickets;
create policy "Users can insert own support_tickets"
on public.support_tickets for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own support_tickets" on public.support_tickets;
create policy "Users can update own support_tickets"
on public.support_tickets for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own support_tickets" on public.support_tickets;
create policy "Users can delete own support_tickets"
on public.support_tickets for delete
to authenticated
using (auth.uid() = user_id);
