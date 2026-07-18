# Recipe Dost Play review readiness

## M23.0A candidate status — 2026-07-18

Source is prepared on `develop` for Recipe Dost `1.0.1` with Android `versionCode 3`. No build, deployment, Play upload, form submission, or production deletion/report request was performed.

Validation: 43 focused compliance/observability/release tests passed; `npm run qa:static`, `npm run functions:check`, development env doctor, and development env validation passed. Production env validation correctly failed only because the four public legal/support URL values are not configured. Expo introspection marks READ/WRITE external storage permissions with `tools:node="remove"`; final release-AAB manifest verification remains required.

## Onboarding finding and route matrix

The reported versionCode 2 binary could not be reproduced from current source: `develop`, `main`, `origin/develop`, and `origin/main` all began this audit at the same commit, which already routed a missing/false local completion flag to Welcome. The observable source defect was that the shared SecureStore adapter swallowed read errors and reduced absent, false, and read-failure states to one default boolean. That made fresh-install evidence ambiguous and prevented a safe error state. A build-provenance or Android-restored-state mismatch remains the likely explanation for the installed binary and must be verified against the EAS build commit.

The patch now uses explicit `pending`, `ready`, and `error` hydration states plus `absent`/`present` key status. It never chooses a route while auth, profile, or storage is pending and never marks onboarding complete after a storage failure.

| State | Destination |
| --- | --- |
| New install, key absent, anonymous session ready | Welcome screen 1 |
| Stored completion false | Welcome screen 1 |
| Local and remote completion true | Home |
| Auth/profile/storage pending | Branded full-screen loading |
| Storage/profile/auth failure | Retryable safe error; no completion mutation |
| Signed out after deletion | Deletion success state; Start fresh creates a new anonymous session and opens Welcome |
| Skip | Persist completion locally and remotely, emit one skipped event, then Home |

## Account deletion

Before this patch deletion was absent (status C): the screen explicitly ended with “request not submitted.” It now calls the authenticated `delete-account` Edge Function. The function validates the bearer session with Supabase, derives `user.id` server-side, uses the server-only admin client, and deletes `auth.users`. Existing foreign keys cascade deletion through profiles, recipe items/cards, collections, grocery lists, usage, subscriptions, metadata logs, support tickets, media jobs/events/private metadata, and AI reports.

After backend success the app clears RevenueCat identity, React Query cache, onboarding storage, PostHog identity, Sentry user, and the local Supabase session. Failure never shows success. Deletion does not cancel a Google Play subscription, and the UI says so. Deployment of the function is still required.

No Supabase Storage upload path is used by the current app. If user-owned Storage objects are introduced later, they must be removed through the Storage API before auth deletion.

## AI content reporting

AI recipe options now expose **Report AI Recipe**. Categories are restricted to the five M23 values; notes are optional, trimmed, and capped at 500 characters. The authenticated Edge Function verifies recipe-card ownership and stores only user ID, recipe-card ID, category, optional note, app/build metadata, and timestamp. A unique user/card/category constraint makes retries idempotent. It stores no source URL, recipe title, ingredients, instructions, prompt, or raw AI output.

PostHog receives only `ai_recipe_report_submitted { category }`. Report notes, recipe content, URLs, IDs, and backend payloads are rejected by the analytics allowlist and are not sent to Sentry.

## Legal and public pages

No verified public Recipe Dost website, privacy page, account-deletion page, support page, or repository hosting pipeline was found. No live URL is claimed. Production now requires valid public HTTPS values for:

- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL`
- `EXPO_PUBLIC_SUPPORT_URL`

Welcome, Settings privacy, deletion, Paywall, and Support expose the configured links. Missing/localhost/HTTP/credentialed/placeholder production values fail validation. Hosting these pages and verifying they do not return 404 remains an external blocker.

The deletion page must identify Recipe Dost and the developer, accept a request without opening the app, explain deleted and retained data, give retention reasons, and include support contact. The privacy policy must cover Supabase, Render, the AI provider, RevenueCat/Google Play Billing, Sentry, PostHog, AI reports, retention, security, rights, and deletion. Owner/legal review is required before publication.

## Reviewer access

The app has no email/password login UI. It creates an anonymous Supabase authenticated session during branded bootstrap, so Play App access should state that all functionality is available without credentials. Do not create or commit reviewer credentials. A fresh reviewer profile starts with the normal free AI allowance; production Supabase anonymous auth, Render worker, AI provider, RevenueCat offering, and network access must all be healthy.

Reviewer path: launch → Welcome/Skip → Home → paste a supported public recipe link → save → generate AI recipe → open AI recipe options → Report AI Recipe; Grocery and Paywall are reachable from tabs/AI usage; account deletion is Settings → Privacy & Data → Delete account & data.

## Release-related app audit

- Production name/package remain `Recipe Dost` / `com.recipedost.app`; versionName stays `1.0.1`.
- Next candidate is local versionCode 3; EAS uses local version source and no auto-increment.
- Production icon, adaptive icon, monochrome assets, and dark splash are configured. Visual device verification is still required.
- Paywall uses localized RevenueCat/Google Play prices, recurring billing language, cancellation guidance, Restore purchases, and Manage subscription.
- No ads SDK, health, government, financial, camera, microphone, contacts, or location feature was found.
- No mocked purchase controls or development identity panel is enabled for ordinary production; observability dev-test flags remain false.
- Link-first positioning remains intact; no video downloading or deleted-video backup was added.
- External storage permissions are blocked because no app code uses shared storage. Expected release permissions are INTERNET and normal VIBRATE; `SYSTEM_ALERT_WINDOW` came from the RN debug manifest and must not appear in the release AAB.

## Play Console declaration checklist

- [ ] Host and enter the verified privacy-policy URL.
- [ ] Host and enter the verified account-deletion URL; test HTTPS and non-404 access while signed out.
- [ ] App access: select all functionality available without special access; explain anonymous bootstrap.
- [ ] Ads: current code contains no ads SDK; owner confirms and selects the accurate declaration.
- [ ] Complete content rating from real recipe/AI behavior.
- [ ] Confirm target audience and age group; do not infer a children audience.
- [ ] Complete Data safety using `docs/data-safety-inventory.md` after owner/legal provider review.
- [ ] Confirm not a government app, not a financial-features app, and not a health app based on actual product scope.
- [ ] Select Food & Drink (owner confirms category), add developer contact details, and complete main store listing/screenshots.
- [ ] Enter support and Terms URLs where requested.
- [ ] Verify App Bundle Explorer permissions; no storage/sensitive permission declaration should be needed for the intended release manifest.
- [ ] Confirm RevenueCat products/base plans, localized prices, grace/account-hold behavior, and subscription disclosures.
- [ ] Create versionCode 3 AAB only after production env/function deployment gates pass.
- [ ] Internal smoke test, then promote to Closed testing and maintain at least 12 opted-in testers continuously for 14 days before production-access application.
