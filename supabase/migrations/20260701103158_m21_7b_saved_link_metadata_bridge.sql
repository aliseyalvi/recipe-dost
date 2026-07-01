alter table public.recipe_items
  add column if not exists duration_seconds integer,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  alter column metadata_status set default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipe_items_duration_seconds_check'
      and conrelid = 'public.recipe_items'::regclass
  ) then
    alter table public.recipe_items
      add constraint recipe_items_duration_seconds_check
      check (
        duration_seconds is null
        or duration_seconds >= 0
      )
      not valid;
  end if;
end $$;

alter table public.recipe_items
  validate constraint recipe_items_duration_seconds_check;
