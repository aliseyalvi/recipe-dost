# M22C Google Play Subscription Preflight Audit

Date: 2026-07-06

## Scope

Audit-only pass for moving Recipe Dost from RevenueCat Test Store testing toward real Google Play Billing internal testing. No app behavior, AI quota logic, entitlement name, or Test Store fallback was changed.

## Summary

Status: M22C.1 package/AAB config readiness patched.

The app-side RevenueCat and backend access model is mostly ready: Supabase `user.id` is used as the RevenueCat app user ID, the entitlement remains `premium`, Test Store management fallback copy still exists, paywall plans come from RevenueCat offerings, and `get-ai-access` remains the app-facing source of truth for access/quota.

M22C.0 found release/config readiness blockers rather than quota logic blockers:

- Google Play / RevenueCat console product and base-plan setup still has to be completed manually.
- Some docs/checklist copy outside this report remains stale for M22C.

M22C.1 decisions:

- Final Android package ID: `com.recipedost.app`.
- Android `versionCode`: `1`.
- Production EAS profile added for Google Play Android App Bundle builds.
- Exact build command: `eas build --platform android --profile production`.
- Warning: the package ID must match the Google Play Console app and the RevenueCat Android app.

M22C.2 cleanup:

- Stale launch checklist subscription docs updated to entitlement `premium`, planned product IDs, base plan IDs, offering `default`, and the Google Play/RevenueCat subscription_id:base-plan-id note.
- Prompt metadata examples now use `premium` instead of old plan naming. This metadata remains descriptive only and must not grant access.
- Settings privacy copy now says Recipe Dost uses RevenueCat for subscription purchase status and subscription management metadata.

## Current Android Package ID

Source: `app.config.js`

Current Android package ID:

```text
com.recipedost.app
```

Readiness: package ID finalized for the first Google Play upload. This value must match Google Play Console and the RevenueCat Android app. Once uploaded to Google Play, the package ID is permanent for that Play app.

Android versioning:

- `expo.version`: `1.0.0`
- `android.versionCode`: `1`

## EAS Profiles and AAB Readiness

Source: `eas.json`

Current profiles:

| Profile | Distribution | Android output | Play Store AAB ready |
| --- | --- | --- | --- |
| `development` | `internal` | `apk` | No |
| `preview` | `internal` | `apk` | No |
| `production` | store/default | `app-bundle` | Yes |

Build command:

```sh
eas build --platform android --profile production
```

## RevenueCat Environment Variables

Mobile/public config:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`, defaults to `premium`
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`, defaults to `default`

Backend/Supabase Edge Function config:

- `REVENUECAT_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`, defaults to `premium`

Android-specific RevenueCat key support: yes. `src/config/revenuecat.ts` exposes `REVENUECAT_ANDROID_API_KEY`, and `src/providers/revenuecat-provider.tsx` configures Purchases only on Android with that key.

iOS-specific RevenueCat key support: no, and that is acceptable for the current Android-first milestone.

## Entitlement and Product Readiness

Required entitlement:

```text
premium
```

Current code default: `premium`.

Planned Google Play products:

- `recipe_dost_premium_monthly`
- `recipe_dost_premium_yearly`

Planned base plans:

- `monthly-autorenewing`
- `yearly-autorenewing`

Paywall product matching currently supports the planned product IDs and also keeps legacy fallbacks:

- Monthly: `recipe_dost_premium_monthly` or `recipe_dost_monthly`
- Yearly: `recipe_dost_premium_yearly` or `recipe_dost_annual`

Readiness: planned product IDs are already supported in the app, but console setup must ensure these products are attached to the RevenueCat `premium` entitlement through the active offering.

## Test Store Fallback

Test Store fallback still exists.

Files:

- `app/paywall.tsx`
- `app/(tabs)/settings.tsx`

When `customerInfo.managementURL` is missing or cannot be opened, the app tells the user that real Google Play subscriptions use store subscription management and Test Store purchases are managed from the RevenueCat test customer.

## RevenueCat Identity

Supabase `user.id` remains the RevenueCat app user ID.

Evidence:

- `src/providers/revenuecat-provider.tsx` calls `Purchases.configure({ apiKey: androidApiKey, appUserID: user.id })`.
- On user changes, it calls `Purchases.logIn(user.id)`.
- `supabase/functions/sync-revenuecat-entitlement/index.ts` fetches RevenueCat subscriber data by the authenticated Supabase `user.id` and writes `revenuecat_app_user_id: user.id`.

Readiness: pass.

## Paywall Offerings and Empty States

Paywall depends on RevenueCat offerings correctly.

Evidence:

- `src/providers/revenuecat-provider.tsx` calls `Purchases.getOfferings()`.
- It selects `offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current`.
- It exposes `currentOffering?.availablePackages ?? []`.
- `app/paywall.tsx` renders monthly/yearly plan cards from the returned packages and uses `selectedPackage.product.priceString`.

Offering/package empty states are handled.

Evidence:

- Not configured: `Premium plans unavailable` with Retry.
- Loading: `Loading Premium plans...`.
- Empty packages: `Premium plans unavailable` with Retry.
- Provider errors set a friendly `Premium plans are not available right now` message.

Readiness: pass, assuming RevenueCat console offering/package setup is correct.

## Restore/Refresh Downgrade Risk

Restore/refresh should not accidentally downgrade backend-active Premium in the current app flow.

Evidence:

- `app/paywall.tsx` restore flow restores, refreshes CustomerInfo, invalidates/refetches `get-ai-access`, and checks backend Premium before showing no-subscription copy.
- `app/(tabs)/settings.tsx` restore flow follows the same backend refetch pattern.
- `src/features/subscription/normalized-subscription-status.ts` treats backend `plan === 'premium'` / `premiumActive` as the display source of truth.
- `supabase/functions/sync-revenuecat-entitlement/index.ts` preserves existing active Premium on malformed/missing entitlement data, identity mismatch, and uncertain RevenueCat responses.

Remaining risk: if RevenueCat/Google Play console products are not attached to the `premium` entitlement, the backend sync can receive a definitive inactive entitlement for the same app user ID and correctly write inactive. That is a console setup risk, not a mobile quota logic change.

## Access and Quota Source of Truth

`get-ai-access` remains the source of truth for app access/quota.

Evidence:

- `src/lib/api/ai-access.ts` invokes `get-ai-access`.
- `app/paywall.tsx`, `app/(tabs)/settings.tsx`, `app/recipe/[id].tsx`, and `src/features/dev-tools/dev-identity-panel.tsx` read `getAiAccessState`.
- `src/features/subscription/normalized-subscription-status.ts` prioritizes backend Premium state over local RevenueCat state.

Free users still get 3 successful AI recipe generations total, and Premium beta users get 100 successful AI recipe cards/month through the backend access helper. No AI quota logic was changed in this audit.

## Backend Function Call Sites

`sync-revenuecat-entitlement` mobile call site:

- `src/lib/api/premium-entitlement.ts`

`syncPremiumEntitlement()` consumers:

- `src/providers/revenuecat-provider.tsx`
- `app/paywall.tsx`
- `app/(tabs)/settings.tsx`
- `app/recipe/[id].tsx`

`get-ai-access` mobile call site:

- `src/lib/api/ai-access.ts`

`getAiAccessState()` consumers:

- `app/paywall.tsx`
- `app/(tabs)/settings.tsx`
- `app/recipe/[id].tsx`
- `src/features/dev-tools/dev-identity-panel.tsx`

## User-Facing Copy: Disallowed Plan Terms

App/source scan result: no disallowed old plan or limitless-usage copy found in `app` or `src`.

Stale docs found in M22C.0 and cleaned in M22C.2:

- Done: `docs/launch-checklist.md` now uses entitlement `premium`.
- Done: `docs/launch-checklist.md` now lists `recipe_dost_premium_monthly` and `recipe_dost_premium_yearly`.
- Done: `docs/launch-checklist.md` now lists `monthly-autorenewing` and `yearly-autorenewing`.
- Done: `docs/ai-prompt-contract.md` now uses `subscription_status: free | premium` as prompt metadata only.

These docs should be patched in M22C, but they are not current app UI copy.

## Unsafe Logs

No unsafe RevenueCat/mobile access logs were found in the audited app paths.

`scripts/qa-static-guards.mjs` checks app/source files for:

- forbidden old plan or limitless-usage copy
- sensitive `console.log(...)` patterns for `customerInfo`, purchase tokens, source URLs, CDN URLs, worker payloads
- committed real-looking secret assignments
- obvious RevenueCat lifecycle side effects in render paths

Backend functions contain structured logs outside the RevenueCat sync path, but this audit did not find raw RevenueCat `customerInfo`, purchase tokens, direct AI provider keys, full source URLs, CDN URLs, or worker secrets being logged by the mobile RevenueCat/paywall/settings/access surfaces.

## Exact Files That Need Patching for M22C

Required before a Play Store internal testing AAB:

- Done in M22C.1: `app.config.js` finalizes Android package ID as `com.recipedost.app`.
- Done in M22C.1: `app.config.js` adds `android.versionCode: 1`.
- Done in M22C.1: `eas.json` adds `production` with Android `buildType: "app-bundle"`.
- Done in M22C.2: `docs/launch-checklist.md` subscription docs cleanup.
- Done in M22C.2: `app/settings/privacy-data.tsx` RevenueCat privacy wording cleanup.

Recommended hardening after console setup is verified:

- `app/paywall.tsx`: decide whether to keep or remove legacy product fallbacks `recipe_dost_monthly` and `recipe_dost_annual`. Keeping them is useful for Test Store/legacy fallback; removing them reduces drift once Google Play products are confirmed.
- `scripts/qa-static-guards.mjs`: optionally add a config/docs drift guard for `premium`, the two planned Google Play product IDs, and old plan-name absence in release checklist docs.
- Done in M22C.2: `docs/ai-prompt-contract.md` prompt metadata cleanup.

No patch recommended:

- `src/config/revenuecat.ts`: current env var names and `premium`/`default` fallbacks are correct for M22C.
- `src/providers/revenuecat-provider.tsx`: Android key support, Supabase appUserID, offerings fetch, and sync hooks are in place.
- `src/lib/api/ai-access.ts`: source-of-truth access call is in place.
- `src/lib/api/premium-entitlement.ts`: mobile sync call site is in place.
- `supabase/functions/sync-revenuecat-entitlement/index.ts`: server-side identity and uncertainty safeguards are in place for the audited flow.

## Manual Console Steps That Cannot Be Done by Code

Google Play Console:

1. Create/select the Google Play app with package ID `com.recipedost.app`.
2. Confirm the package ID exactly matches the RevenueCat Android app. Once uploaded, the package name is permanent for that Play app.
3. Complete required Play app setup for internal testing, including app access, data safety/subscription disclosures, content rating, target audience, privacy policy, and tester access.
4. Create subscription products:
   - `recipe_dost_premium_monthly`
   - `recipe_dost_premium_yearly`
5. Create and activate base plans:
   - `monthly-autorenewing`
   - `yearly-autorenewing`
6. Confirm pricing, renewal period, availability, tax/compliance prompts, and active status.
7. Upload a signed Android App Bundle to an internal testing track.
8. Add internal testers/license testers and confirm they can install the Play build.

RevenueCat Console:

1. Add/link the Google Play app to the RevenueCat project.
2. Confirm the RevenueCat Android app uses package ID `com.recipedost.app`.
3. Connect Google Play service credentials/API access as required by RevenueCat.
4. Import or create the Google Play products above.
5. Confirm entitlement key remains exactly `premium`.
6. Attach both products to the `premium` entitlement.
7. Confirm offering key remains `default` or update `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` consistently.
8. Add monthly/yearly packages to the active offering.
9. Copy the Android public SDK key into the app build environment as `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
10. Verify a real Google Play internal-test purchase produces an active `premium` entitlement for the Supabase user ID shown in Settings developer tools.

Supabase / EAS environment:

1. Set Supabase Edge Function secret `REVENUECAT_API_KEY`.
2. Set Supabase Edge Function secret `REVENUECAT_ENTITLEMENT_ID=premium` if not relying on the default.
3. Ensure EAS build environment has `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
4. Deploy `sync-revenuecat-entitlement` if the currently deployed function is older than the M22B.3 safeguards.

## Validation

Passed in M22C.0: `npm run qa:static`

Passed in M22C.1:

- `npm run qa:static`
- `npx expo config --json >/dev/null`

Passed in M22C.2:

- `npm run qa:static`
