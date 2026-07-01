# Recipe Dost Monetization Plan

## Account Strategy

- Recipe Dost stays anonymous-first for the MVP.
- The Supabase anonymous `auth.users.id` is the primary app user ID.
- RevenueCat `appUserID` must be set to the Supabase `user_id`.
- Optional email login and account backup will be added later without replacing the Supabase user ID model.
- The premium entitlement key is `premium`.

## Credits Strategy

- Free users get 3 lifetime successful AI recipe generations.
- A successful AI generation is a `media_jobs` row where `status = 'completed'`, `result_recipe_card_id is not null`, and `ai_provider is not null`.
- Failed jobs, queued jobs, preview, save, library, and grocery-list viewing do not consume AI credits.
- Premium users get 60 successful AI recipes per month as MVP fair use.
- Admin users get a high operational limit.
- Tester users get `ai_monthly_limit_override` when present, otherwise 100 successful AI recipes per month.

## Dev/Test Roles

Use placeholder IDs only in docs and tickets. Replace the UUID locally with the current Supabase anonymous user ID from the app session.

```sql
-- Make a development user an admin.
update public.user_profiles
set role = 'admin',
    is_test_user = false,
    ai_monthly_limit_override = null
where user_id = '00000000-0000-0000-0000-000000000000';

-- Make a development user a tester with the default tester limit.
update public.user_profiles
set role = 'tester',
    is_test_user = true,
    ai_monthly_limit_override = null
where user_id = '00000000-0000-0000-0000-000000000000';

-- Give a tester a custom monthly AI limit.
update public.user_profiles
set role = 'tester',
    is_test_user = true,
    ai_monthly_limit_override = 250
where user_id = '00000000-0000-0000-0000-000000000000';
```

## Paywall Trigger

- The create-media-job Edge Function returns `ai_credit_limit_reached` before creating a job when a free user has already used 3 successful AI generations.
- The mobile app can use this code to open the future paywall.
- Full paywall UI is intentionally deferred.

## Pricing Assumptions

- MVP subscription is a single premium entitlement, not token bundles.
- The production entitlement mirror lives on `user_profiles`:
  - `revenuecat_app_user_id`
  - `revenuecat_entitlement`
  - `revenuecat_entitlement_active`
  - `revenuecat_updated_at`
- Role, tester, override, and RevenueCat mirror fields are protected from mobile-client updates by a database trigger; update them only from service/admin contexts.
- `PREMIUM_MONTHLY_AI_LIMIT` is 60 while model costs and retention are validated.

## Future Signup/Restore Plan

- Add optional email login/account backup after anonymous usage is stable.
- On login/link, preserve the existing Supabase user identity where possible so RevenueCat `appUserID` remains stable.
- Add a RevenueCat webhook or server sync path to update the `user_profiles` entitlement mirror.
- Add restore-purchase UX only after the paywall and entitlement sync are live.
