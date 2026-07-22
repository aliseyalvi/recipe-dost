create table public.revenuecat_customer_bindings (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  revenuecat_customer_key text not null,
  supabase_user_id uuid not null references auth.users(id) on delete cascade,
  binding_status text not null default 'active',
  first_bound_at timestamptz not null default now(),
  last_verified_at timestamptz,
  last_entitlement_active boolean,
  last_product_id text,
  last_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenuecat_customer_bindings_environment_check
    check (btrim(environment) <> ''),
  constraint revenuecat_customer_bindings_customer_key_check
    check (revenuecat_customer_key ~ '^[0-9a-f]{64}$'),
  constraint revenuecat_customer_bindings_status_check
    check (binding_status in ('active', 'revoked')),
  constraint revenuecat_customer_bindings_environment_customer_key_key
    unique (environment, revenuecat_customer_key),
  constraint revenuecat_customer_bindings_environment_user_key
    unique (environment, supabase_user_id)
);

create table public.revenuecat_sync_state (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  supabase_user_id uuid not null references auth.users(id) on delete cascade,
  sync_in_progress_until timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_result_code text,
  last_latency_bucket text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenuecat_sync_state_environment_check
    check (btrim(environment) <> ''),
  constraint revenuecat_sync_state_environment_user_key
    unique (environment, supabase_user_id)
);

alter table public.revenuecat_customer_bindings enable row level security;
alter table public.revenuecat_sync_state enable row level security;

revoke all on table public.revenuecat_customer_bindings from public, anon, authenticated;
revoke all on table public.revenuecat_sync_state from public, anon, authenticated;
grant select, insert, update, delete on table public.revenuecat_customer_bindings to service_role;
grant select, insert, update, delete on table public.revenuecat_sync_state to service_role;

drop trigger if exists set_revenuecat_customer_bindings_updated_at
  on public.revenuecat_customer_bindings;
create trigger set_revenuecat_customer_bindings_updated_at
before update on public.revenuecat_customer_bindings
for each row execute function public.set_updated_at();

drop trigger if exists set_revenuecat_sync_state_updated_at
  on public.revenuecat_sync_state;
create trigger set_revenuecat_sync_state_updated_at
before update on public.revenuecat_sync_state
for each row execute function public.set_updated_at();

create or replace function public.acquire_revenuecat_sync_lease(
  p_environment text,
  p_supabase_user_id uuid,
  p_lease_seconds integer default 20
)
returns table (
  lease_acquired boolean,
  lease_expires_at timestamptz,
  previous_last_success_at timestamptz,
  previous_last_result_code text,
  previous_last_latency_bucket text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state public.revenuecat_sync_state%rowtype;
begin
  if p_environment is null or btrim(p_environment) = '' then
    raise exception 'environment is required';
  end if;

  if p_supabase_user_id is null then
    raise exception 'supabase user is required';
  end if;

  if p_lease_seconds < 1 or p_lease_seconds > 60 then
    raise exception 'lease seconds must be between 1 and 60';
  end if;

  insert into public.revenuecat_sync_state (
    environment,
    supabase_user_id,
    sync_in_progress_until,
    last_attempt_at
  )
  values (
    p_environment,
    p_supabase_user_id,
    now() + make_interval(secs => p_lease_seconds),
    now()
  )
  on conflict (environment, supabase_user_id)
  do update
  set
    sync_in_progress_until = excluded.sync_in_progress_until,
    last_attempt_at = excluded.last_attempt_at,
    updated_at = now()
  where public.revenuecat_sync_state.sync_in_progress_until is null
    or public.revenuecat_sync_state.sync_in_progress_until <= now()
  returning * into v_state;

  if found then
    return query
    select
      true,
      v_state.sync_in_progress_until,
      v_state.last_success_at,
      v_state.last_result_code,
      v_state.last_latency_bucket;
    return;
  end if;

  select *
  into v_state
  from public.revenuecat_sync_state
  where environment = p_environment
    and supabase_user_id = p_supabase_user_id;

  return query
  select
    false,
    v_state.sync_in_progress_until,
    v_state.last_success_at,
    v_state.last_result_code,
    v_state.last_latency_bucket;
end;
$$;

create or replace function public.bind_revenuecat_customer(
  p_environment text,
  p_revenuecat_customer_key text,
  p_supabase_user_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_binding public.revenuecat_customer_bindings%rowtype;
  v_inserted integer := 0;
begin
  if p_environment is null or btrim(p_environment) = ''
    or p_revenuecat_customer_key !~ '^[0-9a-f]{64}$'
    or p_supabase_user_id is null
  then
    raise exception 'invalid RevenueCat binding input';
  end if;

  insert into public.revenuecat_customer_bindings (
    environment,
    revenuecat_customer_key,
    supabase_user_id
  )
  values (
    p_environment,
    p_revenuecat_customer_key,
    p_supabase_user_id
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  select *
  into v_binding
  from public.revenuecat_customer_bindings
  where environment = p_environment
    and revenuecat_customer_key = p_revenuecat_customer_key;

  if found then
    if v_binding.supabase_user_id <> p_supabase_user_id
      or v_binding.binding_status <> 'active'
    then
      return 'conflict';
    end if;

    return case when v_inserted = 1 then 'created' else 'verified' end;
  end if;

  select *
  into v_binding
  from public.revenuecat_customer_bindings
  where environment = p_environment
    and supabase_user_id = p_supabase_user_id;

  if found then
    return 'conflict';
  end if;

  return 'conflict';
end;
$$;

create or replace function public.persist_revenuecat_entitlement_projection(
  p_environment text,
  p_revenuecat_customer_key text,
  p_supabase_user_id uuid,
  p_entitlement text,
  p_entitlement_active boolean,
  p_product_id text,
  p_expires_at timestamptz,
  p_store text,
  p_synced_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.revenuecat_customer_bindings
    where environment = p_environment
      and revenuecat_customer_key = p_revenuecat_customer_key
      and supabase_user_id = p_supabase_user_id
      and binding_status = 'active'
  ) then
    return false;
  end if;

  insert into public.user_profiles (
    user_id,
    revenuecat_app_user_id,
    revenuecat_entitlement,
    revenuecat_entitlement_active,
    revenuecat_updated_at,
    revenuecat_product_id,
    revenuecat_expires_at,
    revenuecat_store
  )
  values (
    p_supabase_user_id,
    p_supabase_user_id::text,
    p_entitlement,
    p_entitlement_active,
    p_synced_at,
    p_product_id,
    p_expires_at,
    p_store
  )
  on conflict (user_id)
  do update
  set
    revenuecat_app_user_id = excluded.revenuecat_app_user_id,
    revenuecat_entitlement = excluded.revenuecat_entitlement,
    revenuecat_entitlement_active = excluded.revenuecat_entitlement_active,
    revenuecat_updated_at = excluded.revenuecat_updated_at,
    revenuecat_product_id = excluded.revenuecat_product_id,
    revenuecat_expires_at = excluded.revenuecat_expires_at,
    revenuecat_store = excluded.revenuecat_store;

  update public.revenuecat_customer_bindings
  set
    last_verified_at = p_synced_at,
    last_entitlement_active = p_entitlement_active,
    last_product_id = p_product_id,
    last_expires_at = p_expires_at,
    updated_at = now()
  where environment = p_environment
    and revenuecat_customer_key = p_revenuecat_customer_key
    and supabase_user_id = p_supabase_user_id
    and binding_status = 'active';

  return found;
end;
$$;

create or replace function public.complete_revenuecat_sync_lease(
  p_environment text,
  p_supabase_user_id uuid,
  p_succeeded boolean,
  p_result_code text,
  p_latency_bucket text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.revenuecat_sync_state
  set
    sync_in_progress_until = null,
    last_success_at = case when p_succeeded then now() else last_success_at end,
    last_result_code = left(coalesce(p_result_code, 'unknown'), 80),
    last_latency_bucket = left(coalesce(p_latency_bucket, 'unknown'), 40),
    updated_at = now()
  where environment = p_environment
    and supabase_user_id = p_supabase_user_id;

  return found;
end;
$$;

revoke all on function public.acquire_revenuecat_sync_lease(text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.bind_revenuecat_customer(text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.persist_revenuecat_entitlement_projection(
  text, text, uuid, text, boolean, text, timestamptz, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.complete_revenuecat_sync_lease(
  text, uuid, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.acquire_revenuecat_sync_lease(text, uuid, integer)
  to service_role;
grant execute on function public.bind_revenuecat_customer(text, text, uuid)
  to service_role;
grant execute on function public.persist_revenuecat_entitlement_projection(
  text, text, uuid, text, boolean, text, timestamptz, text, timestamptz
) to service_role;
grant execute on function public.complete_revenuecat_sync_lease(
  text, uuid, boolean, text, text
) to service_role;
