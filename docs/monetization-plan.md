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
- Failed jobs, queued jobs, saved-link creation, worker metadata preview, library, and grocery-list viewing do not consume AI credits.
- Saved links, metadata preview, library, and grocery viewing are unlimited for the MVP.
- `save-recipe-link` and `refresh-recipe-metadata` are free backend contracts; only `create-media-job` is AI credit-gated.
- The mobile app must treat `get-ai-access` and `create-media-job` as the AI credit source of truth.
- Premium users get 60 successful AI recipes per month as MVP fair use.
- Admin users get a high operational limit.
- Tester users get `ai_monthly_limit_override` when present, otherwise 100 successful AI recipes per month.

## Dev/Test Roles

Use placeholder IDs only in docs and tickets. Replace the UUID locally with the current Supabase anonymous user ID from the app session.

In development, open Settings -> Dev Identity and tap **Copy User ID**. The panel is visible only in `__DEV__` builds or when `EXPO_PUBLIC_DEV_TOOLS_ENABLED=true`.

```sql
-- Reset a development user to normal free behavior.
update public.user_profiles
set role = 'free',
    is_test_user = false,
    ai_monthly_limit_override = null,
    revenuecat_app_user_id = null,
    revenuecat_entitlement = null,
    revenuecat_entitlement_active = false,
    revenuecat_updated_at = null
where user_id = '00000000-0000-0000-0000-000000000000';

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

-- Simulate active premium from the RevenueCat mirror.
update public.user_profiles
set role = 'free',
    is_test_user = false,
    ai_monthly_limit_override = null,
    revenuecat_app_user_id = user_id::text,
    revenuecat_entitlement = 'premium',
    revenuecat_entitlement_active = true,
    revenuecat_updated_at = now()
where user_id = '00000000-0000-0000-0000-000000000000';
```

Role, tester, override, and RevenueCat mirror fields are protected from mobile-client updates by a database trigger; update them only from service/admin contexts.

## Dev Identity QA

- Use **Create Fresh Anonymous Test User** in Settings -> Dev Identity to locally sign out and create a new anonymous Supabase user. This does not delete remote data.
- Tap **Copy User ID**, run one of the SQL snippets above, then tap **Refresh Access State**.
- To switch between test users on the same device, paste a user ID that appears in the panel's saved anonymous users list and tap **Switch User**.
- Switching by arbitrary UUID is intentionally unsupported because the app has no service role key and no mandatory login credentials.

## Free Credit Limit QA

1. Create or switch to a free anonymous user.
2. Confirm **Refresh Access State** shows `role = free`, `freeLimit = 3`, and the expected `usedSuccessfulGenerations`.
3. Run three successful AI video analyses that complete with `media_jobs.status = 'completed'`, `result_recipe_card_id is not null`, and `ai_provider is not null`.
4. Tap **Refresh Access State** and confirm `remaining = 0` and `reason = limit_reached`.
5. Try another video analysis and confirm `create-media-job` returns `ai_credit_limit_reached` without creating a new `media_jobs` row.
6. Failed jobs do not count toward the limit.

## Paywall Trigger

- The create-media-job Edge Function returns `ai_credit_limit_reached` before creating a job when a free user has already used 3 successful AI generations.
- The mobile app shows "Free AI recipes used" with Unlock Pro and Maybe later actions when this code is returned.
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
