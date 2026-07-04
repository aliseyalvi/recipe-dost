alter table public.user_profiles
  add column if not exists secondary_recipe_language_code text not null default 'ur';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_secondary_recipe_language_code_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_secondary_recipe_language_code_check
      check (secondary_recipe_language_code in ('ur'))
      not valid;
  end if;
end $$;

alter table public.user_profiles
  validate constraint user_profiles_secondary_recipe_language_code_check;
