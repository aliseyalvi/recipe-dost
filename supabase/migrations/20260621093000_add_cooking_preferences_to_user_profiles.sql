alter table public.user_profiles
add column if not exists cooking_preferences text[] not null default '{}'::text[];

create index if not exists user_profiles_cooking_preferences_idx
on public.user_profiles using gin (cooking_preferences);
