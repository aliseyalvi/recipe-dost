create or replace function public.protect_user_profile_account_fields()
returns trigger
language plpgsql
as $$
begin
  if current_role in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role = 'free';
    new.is_test_user = false;
    new.ai_monthly_limit_override = null;
    new.revenuecat_app_user_id = null;
    new.revenuecat_entitlement = null;
    new.revenuecat_entitlement_active = false;
    new.revenuecat_updated_at = null;
    return new;
  end if;

  if new.role is distinct from old.role
    or new.is_test_user is distinct from old.is_test_user
    or new.ai_monthly_limit_override is distinct from old.ai_monthly_limit_override
    or new.revenuecat_app_user_id is distinct from old.revenuecat_app_user_id
    or new.revenuecat_entitlement is distinct from old.revenuecat_entitlement
    or new.revenuecat_entitlement_active is distinct from old.revenuecat_entitlement_active
    or new.revenuecat_updated_at is distinct from old.revenuecat_updated_at
  then
    raise exception 'Protected account fields cannot be changed by the mobile client.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_user_profile_account_fields
  on public.user_profiles;

create trigger protect_user_profile_account_fields
before insert or update on public.user_profiles
for each row execute function public.protect_user_profile_account_fields();
