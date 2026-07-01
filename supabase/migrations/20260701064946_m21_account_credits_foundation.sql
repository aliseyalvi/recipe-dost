alter table public.user_profiles
  add column if not exists role text not null default 'free',
  add column if not exists is_test_user boolean not null default false,
  add column if not exists ai_monthly_limit_override integer,
  add column if not exists revenuecat_app_user_id text,
  add column if not exists revenuecat_entitlement text,
  add column if not exists revenuecat_entitlement_active boolean not null default false,
  add column if not exists revenuecat_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_ai_monthly_limit_override_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_ai_monthly_limit_override_check
      check (
        ai_monthly_limit_override is null
        or ai_monthly_limit_override >= 0
      )
      not valid;
  end if;
end $$;

alter table public.user_profiles
  validate constraint user_profiles_ai_monthly_limit_override_check;

create index if not exists user_profiles_role_idx
  on public.user_profiles (role);

create index if not exists user_profiles_revenuecat_app_user_id_idx
  on public.user_profiles (revenuecat_app_user_id)
  where revenuecat_app_user_id is not null;
