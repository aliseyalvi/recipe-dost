alter table public.recipe_items
  add column if not exists is_favorite boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists recipe_items_active_user_created_at_idx
  on public.recipe_items (user_id, created_at desc)
  where deleted_at is null;
