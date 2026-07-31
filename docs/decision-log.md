# Recipe Dost Decision Log

## 2026-07-30 — M24.7A frontend duration and retry contract integration

- Added one pure frontend policy for explicit source-video/recipe duration
  semantics, effective-limit precedence, dynamic duration copy, and shared CTA
  states. The only compatibility fallback is 180 seconds in that module;
  unknown duration stays eligible for backend evaluation, and ambiguous
  historical `duration_seconds` is never promoted to recipe time.
- Recipe-item/media-job reads now include the deployed explicit duration and
  retry fields. Library duration chips use a clock for `recipe_total_minutes`
  and a play icon for `source_video_duration_seconds`, with a stable empty
  metadata-row height and no fabricated value.
- Failed-job retry now calls authenticated `public.retry_media_job` with the
  existing job ID. Accepted and `already_queued` results optimistically move
  that same cached job to queued, then invalidate/refetch the established
  media-job, recipe-item, recipe-card, Library/Home, AI-access, and usage keys.
  Retry never calls `create-media-job`.
- Removed frontend 120-second generation gates and user-visible two-minute
  warnings from saved-recipe detail, legacy preview, media-job cards, and
  media-job source metadata. Backend actual/max values drive dynamic warnings.
- Validation passed: focused M24.7A + failed-job tests (29/29), `npm run
  typecheck`, `npm run lint`, `npm test`, `npm run qa:static`, `npm run
  functions:check`, and `git diff --check`. `npm run doctor` remains blocked by
  the repository's pre-existing Expo SDK package-version drift (8 packages);
  dependencies were intentionally unchanged.
- No worker, migration, Edge Function, schema, queue, provider, Gemini, quota,
  RevenueCat, EAS, or backend behavior changed, and no live service was called.

## 2026-07-30 — M23.W10C source and recipe duration separation

- Migration `202607300001_m23_w10c_duration_semantics.sql` adds explicit
  `recipe_items` source-video and recipe prep/cook/total fields with bounded
  constraints and semantics version 1. Existing
  `media_jobs.media_duration_seconds` remains the authoritative per-job source
  duration.
- Recipe-card insert/update triggers preserve a valid explicit total or derive
  total only when both valid prep and cook values exist. The compatibility
  `recipe_items.duration_seconds` field is recipe-total seconds only; ambiguous
  historical values become null rather than being guessed.
- Source-video backfill uses only worker-written media-job duration or source
  metadata carrying an allowlisted validation source. Metadata refresh now
  writes `source_video_duration_seconds` and never overwrites the legacy recipe
  duration field.
- `create-media-job` no longer enforces a competing Edge hardcode; worker JSON
  configuration is authoritative. The replaced authenticated W10B RPC permits
  `video_duration_exceeded` retry only when locked job state or a server-written
  event proves 1–180 seconds. Ownership, idempotency, retry limit, quota release,
  same-row queue transition, and grants are unchanged.
- No frontend UI, quota, provider, media, Gemini, queue-liveness, wake, or
  resolver behavior was changed.

## 2026-07-29 — M23.W10B atomic user-owned media-job retry

- `public.retry_media_job(p_job_id uuid)` is the only user retry transition. It
  locks the existing `media_jobs` row, checks `auth.uid()` ownership, result,
  status, lease freshness, retry limit, and an explicit recoverable-error
  allowlist, then requeues the same row and inserts one safe retry event in the
  same transaction. Public/anonymous execution is revoked.
- Only `user_retry_count` and `retry_requested_at` are added. User retries do
  not consume `processing_attempt_count`; source URL/platform, source metadata,
  duration/size, resolver identity, recipe ownership, and valid thumbnails are
  preserved. `video_duration_exceeded` and unknown errors remain non-retryable.
- Quota remains status-derived. A retried row is reservation-free only while it
  is `queued` with `retry_requested_at`; the unchanged W10A atomic claim moves
  it to `resolving`, restoring one active reservation. Failed/released state
  never decrements successful generation usage.
- Offline validation passed TypeScript, all configured Edge checks, the full
  126-test app suite, 102 migration/compliance/static checks, Deno format/lint,
  migration filename uniqueness, secret-pattern review, and diff checks.
- The migration is
  `supabase/migrations/202607290002_m23_w10b_media_job_retry.sql`. It was not
  applied, and no Supabase, Gemini, provider, Sentry, Render, deployment,
  frontend, or raw-media operation was performed.

## 2026-07-29

- M23.W10A keeps its unapplied queue-liveness migration in this canonical
  Supabase-linked repository at
  `supabase/migrations/202607290001_m23_w10a_queue_liveness.sql`. The timestamp
  is unique and newer than the prior `20260722105123` migration.
- The file was moved byte-for-byte from the worker repository; its atomic FIFO
  claim, heartbeat/ownership fields, stale recovery, quota events, grants, and
  SQL contents are unchanged. The migration was not applied and no live
  service was called.

## 2026-07-26

- M24.3B-Q/F keeps the complete user-scoped
  `['ai-access-state', authenticatedUserId]` snapshot during background
  refresh. Incomplete `get-ai-access` data now fails validation instead of
  defaulting missing Premium evidence or counters to Free/zero; refresh errors
  continue to display the last confirmed allowance with a warning.
- A newly created job may reserve one visible slot optimistically without
  changing successful usage or Premium identity. Each terminal media-job
  attempt triggers one authoritative access fetch keyed by `media_job_id`, so
  failure releases and completion conversion settle from backend data.
- Persisted failed AI jobs no longer select the blocking recipe-detail state.
  Saved thumbnail/title/source metadata remains usable with an inline
  “Retry AI recipe generation” card. Only an actively watched attempt that
  transitions to failure gets one full failure presentation; reopening shows
  the metadata screen and inline retry.
- Retry fetches authoritative AI access, requires `canStartAiJob`, and uses a
  synchronous in-flight guard before creating one new job. Existing failed job
  history, Supabase/RevenueCat contracts, quotas, worker behavior, and schema
  remain unchanged.

## 2026-07-23

- M24.3A-R separates authoritative subscription identity from current generation
  availability. Backend `premiumActive=true` confirms Premium regardless of
  `canStartAiJob`; only Generate uses `canStartAiJob` as its immediate gate.
- Restore succeeds when local active Premium evidence reconciles to backend
  Premium, including when the monthly allowance is exhausted or an active job
  reserves capacity. Purchase may close the paywall on the same backend Premium
  confirmation rule.
- Preserve `premium_confirmed` while exposing block reason, remaining-to-start,
  active reservation, successful usage, and monthly limit separately. Premium
  quota exhaustion and active processing use specific user copy; unknown
  normalized blocks use a safe temporary-unavailability message.
- Local Premium/backend Free remains pending. Generate does not open the upgrade
  path for confirmed Premium, does not reconcile merely because quota blocks it,
  and never starts a duplicate job. Backend contracts and quota rules are
  unchanged.

## 2026-07-22

- M24.3A makes `get-ai-access` the sole authority for Recipe Dost AI access.
  RevenueCat `CustomerInfo` remains authoritative store evidence, but local
  Premium can only enter `store_premium_backend_pending`; it cannot grant or
  describe confirmed AI access.
- Replace restore's local-or-backend success test with a shared sequence:
  restore once, inspect returned entitlement/expiry, synchronize once, fetch the
  user-scoped backend access once, then derive the final state. M24.3A-R clarifies
  that Restore success requires backend Premium; `canStartAiJob` is a separate
  generation-availability result. Expired and absent purchases use non-success
  copy.
- Use `['ai-access-state', authenticatedUserId]` everywhere with a conservative
  60-second stale time. Settings remount does not synchronize; bootstrap and
  foreground reconcile only when stale, while purchase/restore/explicit refresh
  always reconcile.
- Mobile synchronization is a shared Promise keyed by Supabase user. Concurrent
  callers await it and receive the same typed result; no caller receives `null`.
  The existing backend lease remains the cross-process protection.
- Register one RevenueCat customer-info listener only after SDK identity is ready,
  reconcile only meaningful entitlement changes, suppress implicit reconciliation
  during explicit store actions, and remove the listener on identity/cleanup.
- Generate recovery now reconciles and automatically retries `create-media-job`
  at most once only when refreshed backend access permits it. The unconditional
  “Premium access synced. Please try again.” message is removed.
- M24.3A requires a new binary because it changes mobile runtime code. It changes
  no database, Edge Function contract, quota, worker/media path, deployment,
  RevenueCat dashboard setting, or existing backend compatibility.

- M24.1D supersedes the reserved custom `SUPABASE_ENV_NAME` setting with
  `RECIPE_DOST_ENV`. Only normalized `development` and `production` are valid;
  there is no deployed fallback to the old name.
- Source inspection confirmed the development 500 was not a module-import throw.
  Request-time configuration validation returned before authentication in the
  handler, service initialization, structured sync logging, and lease acquisition.
- Configuration failures now return HTTP 500 with
  `subscription_sync_configuration_error`, log only fixed configuration names and
  safe status metadata, and omit user correlation when the HMAC inputs are not
  available. Secret values and raw identifiers remain prohibited.
- The binding input remains
  `normalized_environment + ":" + original_app_user_id`; changing the variable
  name does not change existing development key semantics.
- M24.1D is implemented locally/pending development secret update and deploy.
  M24.2 is blocked until development runtime verification succeeds. No schema,
  mobile, worker/media, provider, quota, deployment, merge, or release change was
  made in this implementation.
- M24.0 audit is complete. RevenueCat SDK identity already uses the authenticated
  Supabase UUID; the proven failure was the backend's strict equality check
  against RevenueCat `original_app_user_id`, combined with local/backend state
  presentation and non-coalesced client refresh calls.
- M24.1 accepts an authenticated Supabase UUID that RevenueCat successfully
  resolves as an alias. Ownership is enforced by a unique environment-scoped
  customer binding keyed with `HMAC-SHA-256(environment + ":" + original ID)`;
  conflicting bindings fail closed and never transfer recipes or grocery data.
- Use service-only RLS tables and service-role-only invoker RPCs for binding,
  atomic lease acquisition, projection persistence, and lease completion. The
  mobile request cannot select a target user; `auth.getUser()` remains the only
  source of the Supabase UUID.
- Coalesce server calls with a 20-second lease. Return the existing cached
  projection plus additive in-progress metadata to concurrent callers instead
  of issuing another RevenueCat request or returning null.
- Bound RevenueCat transport to two attempts, eight seconds each, and a short
  backoff. Retry only transient network/5xx failures. Definitive inactive or
  missing Premium clears stale active state; transient failure preserves it.
- Enforce `revenuecat_expires_at` in shared AI authorization. Null remains valid
  for legitimately non-expiring products; exact/past/invalid timestamps are not
  Premium. Quota values and `create-media-job` authority are unchanged.
- Required new server secret: `REVENUECAT_BINDING_HMAC_SECRET`. It is distinct
  per environment, at least 32 characters, server-only, and never printed.
- M24.1A is done; M24.1B deployment was attempted and M24.1C isolated the missing
  environment configuration before M24.1D superseded it.
- Validation passed on the first consolidated attempt: TypeScript, focused Deno
  lint, all configured Edge checks, 25 Deno tests, 7 Node contract/migration
  tests, static guards, both masked env templates, linked development migration
  dry-run, redacted changed-file secret scan, and `git diff --check`.

## 2026-07-18

- M23.0A: replace boolean-only onboarding hydration with explicit pending/ready/error and absent/present state. Storage errors fail visibly and never mark onboarding complete; completion and Skip persist locally/remotely once before Home.
- M23.0A: the versionCode 2 onboarding complaint is not reproducible from the audited commit, which already required both local and remote completion for Home. Treat installed-binary provenance/restored state as an outstanding evidence check; versionCode 3 provides an unambiguous candidate.
- M23.0A: account deletion moves from an honest placeholder to an authenticated Edge Function. The server derives `user.id` from `auth.getUser()`, uses server-only admin deletion, and relies on verified cascade relationships. The client clears RevenueCat, query, onboarding, Supabase, PostHog, and Sentry state only after server success.
- M23.0A: add a narrow `ai_content_reports` table and authenticated report function. Store only safe IDs, normalized category, optional limited note, app/build, and timestamp; do not store source URLs or recipe/AI bodies and do not transmit private report fields to observability.
- M23.0A: do not invent public legal URLs. Require four verified production HTTPS values, surface them in-app, and keep hosting/provider-retention/legal review as external release blockers.
- M23.0A: block transitively declared legacy external-storage permissions because no client code uses shared storage. Keep versionName 1.0.1 and set the next local Android versionCode to 3 without building or submitting.

## 2026-07-16
- M22E.3A prepares `1.0.1` / Android versionCode `2` on `develop` without
  building, submitting, uploading, or merging. `cli.appVersionSource=local` is
  retained and production auto-increment stays absent to prevent double bumps.
- Release architecture decision: keep the production AAB/package/project/signing
  path, add Sentry Metro debug IDs, and target EAS Submit at Internal Testing as
  a draft for human Play review. Runtime observability behavior is unchanged.
- Standalone-build compatibility decision: add the missing `expo-font` peer and
  config plugin required by the existing vector-icon dependency, then align only
  the Expo SDK 56 patch versions identified by Expo Doctor.
- Production deployment decision: `20260711080652_m22e_recipe_management.sql`
  is pending in production and must be applied after merge but before build 2.
  No Edge Function or worker file changed between `main` and `develop`, so do not
  redeploy either service for this release.
- EAS audit decision: the production environment is missing the Sentry/PostHog
  runtime/build variable names. Use the existing allowlisted production sync for
  public values and create `SENTRY_AUTH_TOKEN` separately with secret visibility;
  do not commit or print it.
- Release execution and QA are documented in
  `docs/m22e-1.0.1-beta-release.md`; production build, submission, Play rollout,
  fresh-install/upgrade QA, and dashboard evidence remain external gates.
- M22E.2E freezes observability ownership: app Sentry handles unexpected mobile
  technical failures, PostHog handles only approved product transitions, and
  worker Sentry handles unexpected current queue-flow failures. No tracing,
  profiling, replay, logs, flags, experiments, or legacy worker instrumentation.
- Privacy/identity decision: reconstruct app Sentry events from a safe allowlist,
  retain only Supabase UUID `user.id`, and clear Sentry plus reset PostHog on
  session loss/sign-out/user switch. Both sanitizers have focused sensitive-data
  tests; expected validation/quota/cancellation/onboarding/loading outcomes stay out
  of Sentry.
- QA fix: add the missing React render boundary and named technical-failure report
  sites; dedupe Grocery query error transitions and AI terminal jobs; remove the
  duplicate shared save emissions that normalized beside the generic funnel.
- Environment decision: EAS profiles pin controlled flags false; production
  source-map metadata uses `SENTRY_ORG`/`SENTRY_PROJECT` and a build-only secret
  `SENTRY_AUTH_TOKEN`. Worker reporting now requires Render and exact `main` or
  controlled-test `develop` branch. No deploy, controlled event, app version, or
  Android `versionCode` change occurred.
- M22E.2D detail polish now rejects numeric-only creator IDs in presentation and prefers readable existing author/channel/handle metadata. Saved-source detail uses the same ellipsis options sheet as AI detail for Open Original, Favorite, and Delete; the duplicate bottom Delete section was removed from AI recipe detail. No metadata fetching, backend, schema, access, or analytics behavior changed.
- M22E.2D empty-library polish: Home and Library now reuse one native welcome-aligned “Your recipe library is waiting” card with a culinary recipe/sparkle mark, Obsidian ambient surfaces, concise source-link copy, and a full-width blush Save Recipe CTA. Home shows this as the single no-recipes state instead of stacking separate Recent and AI-empty prompts; the existing save modal and analytics source remain unchanged.
- M22E.2D fresh-data guard correction: app entry now waits for the SecureStore-backed onboarding store to hydrate and requires both local `onboardingCompleted` and remote `user_profiles.onboarding_completed` before bypassing Welcome. This fixes restored Supabase anonymous sessions skipping Welcome after local app data is cleared, while users with both persisted markers continue directly to Home.
- M22E.2D redesigned `/welcome` as a cohesive five-screen native tour covering the brand promise, link saving, AI recipe guidance, Grocery, and the final get-started handoff. The five images in `docs/design/stitch-welcome/` are design guidance only; no screenshot, remote sample content, HTML, or hard-coded image screen ships in the app.
- Architecture decision: retire the old cooking-style/language/household/cooking-level/main-use questionnaire from the active flow. Skip and final Get Started both use the existing profile upsert to persist `user_profiles.onboarding_completed = true`, then replace into Home. The legacy `/onboarding` route redirects to `/welcome`, so old preference screens cannot display; completed remote profiles still bypass welcome and go to Home.
- Presentation decision: use one shared safe-area composition, fixed accessible Skip, concise copy, synchronized indicators, coral pill CTA, responsive UI-built hero cards, and Android hardware Back to the prior welcome page. Existing Reanimated provides only short fade transitions; no pager, carousel, Lottie, image, font, or animation dependency was added.
- Loading decision: add one reusable full-screen branded loader for auth/profile bootstrap, refresh the shared in-screen loader, and replace Home's initial bare loader with an editorial skeleton. Loading timing, query semantics, retry/error handling, Sentry, and the typed analytics boundary remain unchanged; `onboarding_started` fires once when the resolved welcome journey becomes visible and completion analytics remain tied to successful profile persistence.
- Validation and Android device QA results are recorded with the milestone after implementation validation. App version and Android `versionCode` were intentionally unchanged.

## 2026-07-15
- M22E.2B replaced the PostHog placeholders with one fail-closed product-analytics client. Production requires a valid `EXPO_PUBLIC_POSTHOG_API_KEY`/HTTPS host plus production env and variant; ordinary development and all preview builds remain disabled. The exact development-only `EXPO_PUBLIC_POSTHOG_DEV_TEST=true` override exists solely for one Settings verification and is excluded from EAS sync.
- Privacy decision: use typed event names/properties, a runtime property schema, `before_send`, normalized manual screens, UUID-only identify, and reset on logout/session loss/user switch. URLs, route params, raw search/content/errors, tokens, person fields, and RevenueCat/package/transaction payloads are blocked. Session Replay, all autocapture, PostHog errors/logs/flags/surveys/remote config, GeoIP, and debug output are disabled; Sentry alone owns exceptions.
- Funnel accuracy decision: link save/metadata/AI events map only to real existing transitions. AI creation failures are single-counted. `purchase_completed` now requires both local RevenueCat entitlement and refreshed backend Premium access; a locally active but backend-pending result is a normalized failure outcome instead of premature success.
- Audit decision: retain the installed `posthog-react-native@4.50.0` (all missing peers are optional and replay/plugin peers are intentionally absent), add no PostHog Expo config plugin because native symbols/errors are out of scope, remove the unused no-op config, and supersede the stale wizard report. No PostHog org/project was created.
- Validation: static QA, final typecheck, nine focused analytics tests, Expo config generation, guards, and both env templates passed. Real development doctor/validator and production validator correctly stopped because the existing `EXPO_PUBLIC_POSTHOG_HOST` value is not an HTTPS origin; real env files were intentionally not edited. Device/Live Events QA and dashboard verification remain pending, and no PostHog connector was available for dashboard work.
- M22E.2A-SENTRY-GATE replaced the Sentry no-op with fail-closed runtime initialization while keeping the existing provider surface. Transmission requires a valid public DSN and generated Expo permission; production additionally requires `APP_ENV=production` plus the production variant.
- Decision: development and preview remain disabled by default. Only the development variant may temporarily opt in with the exact `EXPO_PUBLIC_SENTRY_DEV_TEST=true` override for one controlled verification; preview stays blocked even with that flag, and the flag is not stored in checked-in env examples or EAS profiles.
- Privacy decision: the initial gate disables PII, tracing, failed-request capture, screenshots, view hierarchy, and breadcrumbs, and removes request/user/message/context/extra/fingerprint fields before an event can leave the app. Missing or malformed DSN/configuration is a no-op and never blocks startup.
- Validation: the development-default, explicit development-test, preview-with-override, and production Expo-config matrix passed; `npm run typecheck` passed after the SDK callback was narrowed to its required `ErrorEvent` type.

## 2026-07-14
- M22E.1R-ICONPOLISH1 standardized the app's visible navigation, recipe metadata, favorite, platform, Grocery, and utility iconography on `develop`; Android visual QA is pending.
- Decision: declare Expo-compatible `@expo/vector-icons` and use Ionicons as the canonical family. The audit found no declared usable vector library; wrong/missing visuals came from Unicode glyph maps, text initials, and absent Home metadata marks rather than invalid vector names. This later focused dependency supersedes the earlier stabilization-only text-glyph treatment without changing those screens' behavior.
- Decision: route every semantic glyph through typed `AppIconName` mappings and normalize provider values through a closed platform resolver. Instagram, YouTube, TikTok, and Facebook use supported Ionicons brand glyphs; unknown values use `link-outline`; arbitrary backend values never become icon names.
- Decision: share one favorite control (`heart-outline` / `heart`, identical 44px footprint), one coral glass AI Recipe badge (`sparkles`), and one metadata chip across Home and Library. AI plus favorite renders both controls, and unavailable creator/duration data is omitted.
- Decision: map tabs to matching outline/filled Home, Library, cart, and Settings pairs; keep Add as the existing central plus. Replace Grocery's upload-like Share glyph with `share-social-outline` while preserving the existing native handler, copy behavior, checked state, routes, and safe-area layout.
- Decision: migrate remaining in-scope detail, menu, Settings, Paywall, processing, and Add-sheet glyph substitutions to typed Ionicons. No remote icon assets, arbitrary casts, new requests, schema/backend/worker/access/RevenueCat changes, or sensitive logging were introduced.
- Milestone state: M22E.1R-GROCERY1, M22E.1R-SETTINGS1, M22E.1R-PAYWALL2, and M22E.1R-ICONPOLISH1 are Done; M22E.2 is Next. Shipping this runtime/dependency change through Google Play requires the guarded versionCode 2 build after `develop` QA and promotion to `main`.
- M22E.1R-PAYWALL2 replaced the full-screen Paywall composition with one native editorial RevenueCat sheet on `develop`; Android purchase QA is pending.
- Decision: retain `/paywall`, the existing RevenueCat provider/configured `default` offering, `premium` entitlement, purchase/restore/customer refresh/backend sync, and `get-ai-access`. Split only presentation and pure package/access/error normalization into focused Paywall helpers; do not add a sheet, icon, billing, or state dependency.
- Decision: accept only `recipe_dost_premium_monthly` and `recipe_dost_premium_yearly` store products, including RevenueCat's `product-id:base-plan-id` form. Use real `priceString`, select Yearly by default when available, never infer savings, and show introductory copy only from real `introPrice` fields.
- Decision: keep the comparison exact at Free 3 total successful AI cards versus Premium 100 successful AI cards/month, with free saved links/search and generated-card-scoped help/ingredients/steps/Grocery. Usage comes only from authoritative `get-ai-access` fields and is clamped for presentation without changing access decisions.
- Decision: purchase completion refreshes RevenueCat customer information, the existing Premium entitlement synchronization, and backend access queries before closing. Cancellation, pending, unavailable, already-owned, restore-none, and generic failure remain friendly inline sheet states; a synchronous guard blocks duplicate actions and generation is never auto-resumed.
- Decision: active Premium hides purchase plans/CTA and exposes real usage plus Manage/Restore/Close. Offering mismatch/absence exposes Retry/Restore/Close and no placeholder price. The real RevenueCat management URL is the only manage target.
- Decision: pass typed, analytics-only trigger values from every current entry point and return with `router.back()` so underlying screen state survives. No post-result upgrade prompt exists, so none is invented. Events contain only safe trigger/plan/product/state categories and never price/payment/customer/access payloads.
- Design-reference note: `stitch-paywall/screen.png` and `code.html` currently depict Settings, so PAYWALL2 uses their Obsidian/glass/coral language and `DESIGN.md`, while the explicit milestone brief supplies the sheet composition. No HTML/Tailwind or sample assets are imported.
- Release decision: this runtime/UI change requires Android `versionCode` 2 when promoted and shipped, but the value is not bumped on `develop`.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android sheet, purchase, restore, and store-state QA remains pending because no connected emulator/device is available in this workspace.
- M22E.1R-SETTINGS1 redesigned Settings as the native Obsidian editorial experience on `develop`; Android device QA is pending.
- Decision: preserve the existing `get-ai-access`, RevenueCat provider, paywall route, restore, customer-info refresh, backend entitlement sync, profile query, language route, privacy route, deletion information route, query keys, and production development-tool guard. Do not change quota/access logic, entitlement/products, configuration, schema, backend/worker, package IDs, or env files.
- Decision: render mutually exclusive Free and Premium subscription states from normalized real access. Free receives Upgrade/Restore/Refresh; active Premium receives Manage/Restore/Refresh and no purchase CTA. Use valid RevenueCat renewal/access metadata only when available and never expose product/internal payload details.
- Decision: prevent overlapping subscription actions with one synchronous in-flight guard and replace native success/failure Alerts with themed inline feedback. Store management remains conditional on the real RevenueCat management URL and reports honest Test Store/unavailable behavior otherwise.
- Decision: the app has no declared vector-icon dependency. Centralize the established typed code-native glyph treatment in `SettingsIcon` instead of adding a dependency during stabilization.
- Decision: show only a six-character masked anonymous profile identifier, persisted supported secondary language, the real Dark-only appearance, and Expo/native version + Android build. With no configured support address, Contact support remains visible but non-interactive and honestly unavailable.
- Decision: keep deletion request-based and unconnected. Use a themed confirmation sheet, then explicitly state that no request was submitted and no data was deleted; do not add schema/backend automation or a fake support path.
- Production safety: developer diagnostics remain guarded by `__DEV__ && APP_ENV === 'development'`, so APP_ENV production hides the entire section and identity controls.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android visual and interaction regression QA remains pending because no emulator/ADB target is available in this workspace.

## 2026-07-13
- M22E.1R-GROCERY1 redesigned the existing Grocery overview and selected-list state on `develop`; final automated validation and Android QA are pending.
- Decision: preserve `/grocery` and `/grocery?recipeCardId=[recipe-card-id]`, `recipe_cards` as the list source, the existing Grocery query keys, and route-local non-persisted checked IDs. Do not write the unused `grocery_lists` table or imply cross-screen completion persistence.
- Decision: treat the Stitch overview as visual structure only because it is semantically an AI Recipes screen. Use real Grocery title/data, client-side safe search, All/Active/Completed/Recent filters, real thumbnail/source enrichment, progress, and an honest empty state; never ship sample recipes/images or fake meal filters.
- Decision: reuse existing `recipe_items`/media metadata for thumbnail, platform, creator, duration, and safe source title, and preserve real ingredient notes when grocery names match. Reject URL-like visible titles/creators and never track query text or source URLs.
- Decision: render detail with a `SectionList`, local English/Urdu/Both selection, only real Urdu text, real categories when present, and one Ingredients group otherwise. Current generated grocery data has no reliable category, separate unit, or persisted checked field; schema/API work is deferred.
- Decision: keep clipboard copy and add text-only native `Share.share` with friendly failures. The dark overview menu exposes Open shopping list, Open recipe, Copy list, and Share list only; no delete action or new dependency is added.
- Decision: reuse the existing `get-ai-access` function for the Grocery header pill and unchanged `/paywall`; quota/access, RevenueCat, products, entitlement, worker, Edge Functions, schema, package ID, and env files remain unchanged.
- Release decision: this runtime/UI milestone requires Android `versionCode` 2 only when promoted from `develop` and shipped; the patch does not bump it.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android interaction, clipboard/share, filter-state, and visual regression QA remains pending.

## 2026-07-12
- M22E.1R-DETAIL2 cleaned the AI-ready header/menu, source metadata, unknown stats, and Home-to-Library section navigation on `develop`; Android QA is pending.
- Decision: replace the AI-ready external-arrow header action with one ellipsis and move Open Original into a themed detail Modal. Include only existing safe Open Original, View Saved Source, Favorite, and soft Delete actions; hide Share and Generate because no ready-detail share flow exists and generation is already complete.
- Decision: no icon dependency is installed or added. Use non-directional code-native chain/source, creator, duration, ellipsis, heart, and delete treatments consistent with Library.
- Decision: move user-useful platform, safe creator, source duration, and source-available metadata directly below the hero. Remove development/model/provider diagnostics from rendered UI and never expose raw URLs.
- Decision: hide difficulty/servings for empty, unknown, not specified, or n/a values, and rename Culinary Method to Recipe Steps without changing localized data.
- Decision: Home section buttons deep-link to the existing Library with `tab=recent|favorites|ai_recipes`; Library validates the param, while the bottom tab always sends Recent and manual selection remains local.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android menu, deep-link, and visual regression QA remains pending.
- M22E.1R-DETAIL1 implemented the native state-driven saved-source and AI-ready detail redesign on `develop`; Android device QA is pending.
- Decision: preserve `/recipe/[id]` as the generation/access/polling controller and `/recipe-card/[id]` as the direct ready-card route. Add shared presentation components and a typed five-state resolver rather than merging routes or duplicating job logic.
- Decision: state priority is card/result, active job, terminal failed job, active metadata, failed metadata, then ready metadata. Keep bounded polling, focus/foreground refetch, completed-result replacement, returnTo handling, and existing query keys.
- Decision: translate all three Stitch detail references into native Obsidian/coral surfaces only. The metadata HTML, not its blank screenshot, is the source for the fetched 9:16 hero/action composition. Do not ship Stitch sample images, recipes, nutrition, HTML/Tailwind, fonts, or duplicate bottom navigation.
- Decision: use HOME2 title/creator normalization, existing thumbnails, real tags/stats/ingredients/steps, and existing bilingual controls. Hide absent fields and omit nutrition because no real nutrition contract exists.
- Decision: preserve create-media-job access/Paywall/RevenueCat logic, original-source behavior, Favorite/Delete, Grocery, tag search, and safe analytics. Recipe scaling, AI edit, PDF/export, meal planner, generated nutrition, scraping, and video storage remain out of scope.
- Release decision: Android `versionCode` 2 is required only when this runtime/UI update is shipped from `main`; do not bump it on `develop`.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android state-transition, visual, and regression QA remains pending.
- M22E.1R-LIBRARY1B polished Library icons, card controls, and the action menu on `develop`; Android device QA is pending.
- Decision: do not install an icon dependency. None of `@expo/vector-icons`, Lucide, `react-native-vector-icons`, or `react-native-svg` resolves as an installed app package. Use a typed local editorial-symbol helper and explicit boxed IG/TT/YT/FB marks; remove the directional arrow from source/creator metadata.
- Decision: every card shows a real Favorite control, semantic state badge, and three-dot menu control. Platform, creator, and duration become consistent translucent metadata chips backed only by existing fields.
- Decision: replace the native action Alert with a dark safe-area-aware React Native Modal bottom sheet. It supports backdrop/close/Android-back dismissal, inline mutation errors, and an in-sheet destructive confirmation.
- Decision: show Open original only with a source URL; use the existing saved-detail route for Generate/View progress and existing AI-card route for View AI Recipe. Do not duplicate AI creation, access, or retry logic in Library.
- Decision: Favorite and Delete are enabled because M22E.1R-D already provides persisted `is_favorite`, soft `deleted_at`, ownership-scoped mutations, and RLS-safe reads. Update/invalidate Library, Home, detail, card, and grocery caches; never log the source URL. No LIBRARY2 schema/API milestone is needed.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android interaction and visual regression QA remains pending.
- M22E.1R-LIBRARY1 implemented the Stitch-inspired editorial Library and search redesign on `develop`; Android device QA is pending.
- Decision: keep `getRecipeLibrary()` and `['recipe-library', user.id]` as the only Library data path. Recent uses all rows newest first, Favorites uses persisted `recipe_items.is_favorite`, and AI Recipes requires a real card/completed result; no sample recipes, backend search, schema, worker, quota, RevenueCat, product, package, or env change is allowed.
- Decision: normal chips execute real client-side queries and active suggestions come only from loaded tags, meal type, cuisine, and platform. Quick may additionally match real AI prep + cook time of 30 minutes or less. The visual Filters label does not claim an unsupported filter sheet.
- Decision: reuse HOME2 display title/creator normalization and existing thumbnails. Full-width image cards map saving/pending, active AI stages, failed/needs-caption, saved-link, and AI-card states without changing their detail routes or bounded refresh behavior.
- Decision: Favorites are implemented because M22E.1R-D already supplies schema-backed favorite data. Favorite/delete mutation stays on detail screens. The Library card menu is non-destructive and contains only View recipe and Open original.
- Decision: the usage pill reuses `get-ai-access` and opens the existing Paywall. The Stitch HTML/Tailwind, sample content/images, and unbundled fonts remain references only; native theme tokens and the safe serif fallback are used.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android visual, keyboard, navigation, share-sheet, and paywall regression QA remains pending.
- M22E.1R-HOME2 removed duplicate Home processing presentation and normalized editorial card titles on `develop`; Android device QA is pending.
- Root cause: Home independently selected the same newest library row as both `processingRecipe` and `recentRecipe`, so one saved item rendered in Currently Processing and Recent. Decision: remove the separate section and keep all preparing/processing presentation and navigation inside Recent.
- Decision: title precedence is AI card title, meaningful media/source metadata title, cleaned stored caption/description, non-weak item title, then platform recipe-link fallback. Reject creator-only “Video by” / “Post by” text, creator-equivalent titles, platform-only text, and raw URLs without changing stored values.
- Decision: show creator/channel separately using existing safe author, creator, channel, uploader, username, handle, and ownerUsername variants; use platform as the chip fallback and never expose or track source URLs.
- Decision: include existing `recipe_items.description` and `duration_seconds` in the same `recipe-library` query. Preserve its query key, bounded processing polling, save/AI invalidation, focus/foreground refetch, saved/AI detail routes, and `/paywall` usage-pill action.
- Deferred: providers that supply neither a meaningful title nor caption/description will use safe platform fallback until a separate worker/provider metadata-quality patch is approved.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android visual/lifecycle QA remains pending.
- M22E.1R-K0 recovered the P0 Add/share entry regression on `develop`; Android device QA is pending.
- Root cause: the K extraction moved imperative Gorhom presentation ownership out of the stable global provider and into the visual child. Both center Add and share intent still called the provider, but the proven provider state-to-sheet transition had been removed.
- Decision: restore `SaveRecipeModalProvider` as the sole owner of `isOpen` to `present()` / `dismiss()` transitions and keep `ImportRecipeSheet` presentation-only. Retain the editorial UI; no route fallback is needed.
- Decision: center Add and native share intent share the restored sheet. `/share-recipe` passes the extracted URL into it, `/save-recipe` compatibility is unchanged, and confirmed saves still open `/recipe/[id]?returnTo=/home` after list invalidation and metadata refresh.
- Decision: do not add diagnostic URL logging, dependencies, backend/schema changes, media-job creation, or quota/RevenueCat/product changes for this regression fix.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android interaction and live native-share QA remain pending.
- M22E.1R-K redesigned the existing Add/share bottom sheet on `develop`; Android device QA is pending.
- Decision: retain `SaveRecipeModalProvider` as the single orchestration path and extract only the native Gorhom presentation into `ImportRecipeSheet`. Center Add, native share intent, `/share-recipe`, and `/save-recipe` compatibility remain intact.
- Decision: visible copy emphasizes Instagram, TikTok, and YouTube, while unchanged validation/backend behavior continues accepting Facebook and backend-safe `other` HTTP(S) links. Do not add a new dependency or restrict an existing supported flow.
- Decision: wait for confirmed `save-recipe-link` success, then update/invalidate recipe lists, start existing metadata refresh, close, and navigate to `/recipe/[id]?returnTo=/home`. Do not create a media job or fake processing success at save time.
- Decision: invalid URL, clipboard, duplicate, auth/session, and API/network failures stay inline and friendly. Analytics records source/platform/result categories only and never raw URLs.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; Android interaction and live save/share QA remain pending.
- M22E.1R-G2 corrected Home behavior after the editorial redesign without changing its visual direction.
- Decision: Home order is processing when active, Recent, conditional Favorites, then AI Generated. Recent is the primary retrieval surface and sorts real library items by the newest parent/card/job activity timestamp.
- Decision: tapping Currently Processing opens `/recipe/[id]?returnTo=/home` using the parent item ID so the existing saving/preview/job state remains visible; only the explicit Open Library button routes to `/library`.
- Decision: Recent routes saved links to `/recipe/[id]` and real/completed AI cards to `/recipe-card/[id]`. Existing bounded polling, focus/foreground refetch, and list invalidations are sufficient; no new endpoint or infinite polling was added.
- Decision: the AI usage pill opens the existing `/paywall` route for every access state and records plan category only. Favorites is hidden without a real persisted favorite; no favorite/delete schema or fake empty card was added.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; device behavior QA remains pending.
- M22E.1R-G implemented the editorial design foundation and real-data Home redesign on `develop`; device QA and screenshot review are pending.
- Decision: treat the Stitch Home HTML, Tailwind, screenshot recipes, and imagery as visual reference only. Native typed components use the Obsidian/coral palette, serif heading slot, translucent surfaces, 20px cards, image fallback, and editorial section rhythm without importing sample/static recipes or dummy image URLs.
- Decision: Home shares `['recipe-library', user.id]` with Library so actual active metadata/jobs, persisted `is_favorite`, and newest generated cards stay synchronized. The usage pill calls the existing `get-ai-access` client only; quota/access and Premium logic are unchanged.
- Decision: keep startup-safe `serif` and system-sans font slots because Bodoni Moda/Work Sans packages or bundled assets are absent. Add exact bundled fonts only in a later dependency-reviewed patch.
- Decision: preserve all tab route names and the current save modal; the center Add FAB is presentation and analytics only. Do not bump versionCode on `develop`; versionCode 2 is required when this runtime/UI update is prepared for Play from `main`.
- Validation: `npm run qa:static`, development env doctor, and both development/production env validators passed with masked output; device UI QA remains pending.

## 2026-07-11
- M22E.1R-F implemented the professional app-side processing-state recovery on `develop`; device QA is pending.
- Decision: a shared detail panel maps the existing metadata and media-job statuses to Saving link, Preparing preview, Watching video, Extracting recipe, Creating recipe card, Ready, and Failed. It uses only backend-supplied numeric progress, otherwise shows an indeterminate status check; it does not invent timing or completion claims.
- Decision: Go to Library only changes route and leaves the active job running. Wait here performs one explicit recipe/media-job refetch with an in-button checking state. Existing bounded polling, Home/Library focus refetch, foreground refetch, completed-card invalidation, failure retry, and auto-open behavior remain unchanged.
- M22E.1R-E implemented the professional app-side paywall redesign on `develop`; device QA is pending.
- Decision: the paywall now separates Free and Premium in a compact table: Free has saved links, Library search, and 3 total AI recipe cards; ingredient, step, recipe-help, and grocery content applies only to those generated cards. Premium retains 100 AI recipe cards/month, Urdu + English recipe help, ingredients/steps/grocery lists, up-to-2-minute beta support, and priority beta improvements.
- Decision: retain the existing `get-ai-access` query for the usage card and existing RevenueCat selection, purchase, restore, management, unavailable, and active-Premium code. The new bottom purchase area is presentation-only; it does not change products or the `premium` entitlement.
- M22E.1R-C follow-up: Library tag-search rows now prioritize tags that match the active query, render the same pending/failed/AI state as grid cards, and use a fixed 92 by 92 thumbnail with cover scaling so row content cannot stretch image geometry.
- M22E.1R-D implemented schema-backed favorite and soft-delete recipe management on `develop`.
- Decision: favorite and soft-delete state live on `recipe_items`, the shared parent of saved links, AI cards, and media jobs. The migration adds `is_favorite boolean not null default false`, nullable `deleted_at`, and an active-library partial index; `recipe_cards` needs no duplicate state.
- Decision: keep the existing ownership RLS policies. App mutations additionally filter by current `user_id`, parent `id`, and active `deleted_at` state. Soft delete preserves recipe/job/accounting records but all active Home, Library/Search, detail, and grocery reads now require a non-deleted parent.
- Decision: no quota/access or RevenueCat behavior changes. A soft-deleted card remains excluded from presentation but is not treated as a reversal of a completed AI generation.
- Development deploy: after linking the development project once, apply `20260711080652_m22e_recipe_management.sql` with `node scripts/env/run-with-env.mjs development -- supabase db push --linked` after review. Production deployment remains blocked on development QA.

## 2026-07-10
- M22E.1R-C implemented professional Library search and tag UX on `develop` without backend or schema changes.
- Decision: retain client-side search over fetched, user-owned Library data for beta scale. Active text searches use compact result rows and add only existing `time_json`/`servings` fields to the current `recipe_cards` read; no new query key, access rule, or remote search endpoint was introduced.
- Decision: detail tags are rounded, capped at eight, and navigate to `/library?query=<tag>`. Analytics records safe interaction/count metadata only; raw tags and search text remain untracked.
- Decision: Home remains a browsing surface, while Library is the dedicated text-search surface. Existing grid browsing, content filters, sort modes, refetch behavior, and empty-tag compatibility remain intact.
- Validation: `npm run typecheck`, `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, and `node scripts/env/validate-env.mjs production` passed.
- M22E.1R-A completed a documentation-only professional UX recovery audit on `develop` after M22E.1D/E QA feedback.
- Decision: `recipe_cards.tags_json` exists and the mobile app reads it conditionally, but the active media-job card writer is the external Render media worker. The legacy in-repo `generate-card` function writes tags but is not the user-facing generation path. Fix the worker recipe-card prompt/schema and persistence mapper before re-evaluating tag UI/search.
- Decision: keep M22E.1B app-state refresh and M22E.1D list normalization, but replace the current search/tag presentation, paywall comparison composition, and processing-state visual hierarchy. Do not revert original-video placement or existing retry behavior.
- Decision: favorite requires `recipe_items.is_favorite boolean not null default false` plus regenerated types. Confirmed hard delete is feasible with existing user-owned RLS/cascades, but must handle or explicitly accept stale IDs in `grocery_lists.source_recipe_ids`.
- Decision: paywall recovery centers Free = 3 AI recipe cards total and Premium = 100 AI recipe cards/month, then explains shared generated-card benefits once. Do not change Google Play products, access logic, or RevenueCat entitlement `premium`.
- Validation: `npm run qa:static` and `node scripts/env/env-doctor.mjs development` passed.
- M22E.1E polished processing and paywall copy after QA feedback.
- Decision: AI processing now shows explicit leave/wait actions while keeping current auto-open-on-complete behavior. Leaving returns to Home/Library and relies on the existing Home/Library focus/foreground refresh from M22E.1B.
- Decision: Metadata pending copy now uses "Preparing preview..." only for pending preview fetches; saving and failed metadata states have separate friendly copy, and failed metadata keeps the existing retry path.
- Decision: Paywall comparison now avoids implying free users get unlimited ingredient/step generation. Free copy is 3 total AI recipe cards, unlimited saved links, and ingredients/steps/grocery data only on generated AI cards; Premium remains 100 AI recipe cards/month with existing products and entitlement.
- Decision: Usage clarity uses the existing `get-ai-access` query already loaded on Paywall. No new backend call, quota/access logic, product, or entitlement change was added.
- QA note: M22E.1D tag search/chips only surface existing `recipe_cards.tags_json`. If newly generated cards still have empty tags, that requires a separate prompt/Edge Function contract patch; M22E.1E stays app-side only.
- Validation: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, and `node scripts/env/validate-env.mjs production` passed.
- M22E.1D shipped the first low-risk competitor UX cherry-picks as app-side/UI-only changes on `develop`.
- Decision: Library search now stays client-side over fetched user-owned rows and includes title, source metadata, platform/source URL, notes/caption/manual ingredients, cuisine/meal type, AI recipe title/summary, tags, ingredients, and steps. This avoids new backend search, RLS, or indexing risk for the beta dataset.
- Decision: AI tags reuse existing `recipe_cards.tags_json`; no tags schema migration or Edge Function prompt contract change was made in this patch.
- Decision: Favorite/unfavorite, delete with confirmation, and manual tags remain deferred because they need a schema/API review. Do not add `recipe_items.is_favorite` or destructive delete UI until a separate dev-QA migration patch is approved.
- Decision: Processing copy now tells users they can leave while AI/metadata work continues, Open Original Video has stronger saved-link detail placement, and paywall comparison copy preserves Free = 3 successful AI generations, Premium = 100 AI recipes/month, and 2-minute beta video length.
- Validation: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production` passed.
- M22E.1C documented competitor UX cherry-pick decisions from ReciMe/Pluck-style recipe app review without runtime changes.
- Decision: Selected low-risk improvements are broader recipe search, AI tag chips, favorites, delete with confirmation, clearer leave-while-processing state, better Premium benefit comparison, optional usage/credits pill from existing access data, stronger Open original video placement, New AI Recipe ribbon, and basic manual tags.
- Decision: Avoid nutrition/macros, meal planner, recipe scaling, PDF export, AI edit, photo import, folders/cookbooks, push notifications, and video downloading/storage for now because they expand scope, trust/liability, permissions, data model, or compliance risk beyond M22E.
- Decision: M22E.1D should start with app-side/UI-only improvements that do not require schema/backend changes, then separately review favorites/delete/manual tags if they need database or API work.
- Validation: `npm run qa:static` passed for M22E.1C.
- M22E.1B stabilized Home/Library app-state refresh for saved-link metadata without backend, worker, quota, RevenueCat, package ID, or env changes.
- Decision: `recipe_items.metadata_status = saving | pending` are active list states for refresh purposes, but metadata polling is bounded by recent `updated_at` age to avoid unbounded network polling if a row is stuck.
- Decision: Home `['recent-recipes', user.id]` and Library `['recipe-library', user.id]` now refetch on screen focus and app foreground resume, so metadata completed while the app was backgrounded can replace stale Preparing Preview cache state.
- Decision: Fast AI job responses that already include `result_recipe_card_id` invalidate Home/Library list keys in addition to the recipe-card key; the existing result-ID effect still invalidates recipe item, recipe card, media-job, list, and AI access keys.
- Validation: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, and `node scripts/env/validate-env.mjs production` passed.
- M22E.1A audited app startup/onboarding routing and Home/Library stale metadata state without changing runtime behavior.
- Decision: Welcome skipping is expected for a returning Supabase anonymous session whose `user_profiles.onboarding_completed` is true; a true clean install must be verified by clearing/restoring no prior app data.
- Decision: Home/Library stale metadata is likely an app-side cache/refetch gap: list queries poll active media jobs but not `recipe_items.metadata_status = saving/pending`, and there is no Home/Library focus or foreground refetch bridge.
- Decision: The minimal fix should stay app-side: add active metadata polling plus Home/Library focus/foreground refetch for existing list query keys. Do not change quota/access logic, RevenueCat entitlement, backend/worker logic, package IDs, or env files.
- Decision: A production AAB update for the runtime fix will require Android `versionCode` 2; this audit-only docs patch does not require an AAB.
- Validation: `npm run qa:static` and `node scripts/env/env-doctor.mjs development` passed.

## 2026-07-09
- M22E.0A added release branch and env safety guards before M22E bug fixes.
- Decision: `main` is production-stable and `develop` is daily development; M22E bug fixes happen on `develop` first, then merge to `main` after QA.
- Decision: Production Android App Bundle builds must run through `npm run build:prod` from `main`; `ALLOW_NON_MAIN_PROD_BUILD=1` is the explicit emergency override.
- Decision: Development and preview builds normally run from `develop`, warn on other branches, and continue using `env/development.env`.
- Decision: `env/development.env` and `env/production.env` remain gitignored source-of-truth files loaded only through `scripts/env/*`; production env should not be manually sourced in a normal terminal.
- Decision: Env doctor prints only operator-safe summary fields and never raw secret values.
- Decision: README now documents the normal development workflow, production smoke command, guarded build commands, env deploy commands, and release flow.
- Validation: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/env-doctor.mjs production`, and `node scripts/env/run-with-env.mjs development -- npx expo config --json >/dev/null` passed.

## 2026-07-08
- M22C.3B.1 documented the Google Play verification wait-state and store prep checklist.
- Decision: Google Play developer identity/phone verification is an external blocker; Play app/internal test upload, Play subscriptions/base plans, RevenueCat Google Play product import, and sandbox purchase testing may remain blocked until approval.
- Decision: Production EAS Android App Bundle build has been started and is queued; continue store listing copy, screenshots, privacy policy, data safety draft, app access instructions, content rating draft, and RevenueCat product planning while waiting.
- Decision: M22C remains in store-prep wait-state with entitlement `premium`, offering `default`, package IDs, quota/access logic, real env files, and Test Store fallback unchanged.
- M22C.3A audited RevenueCat environment sanity and paywall readiness before Google Play setup.
- Decision: `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` remains canonical; old `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` remains fallback-only in app code and is rejected from canonical env files by validation.
- Decision: Production env validation now rejects RevenueCat Test Store Android public SDK keys, while development may use Test Store keys only for documented local/Test Store testing.
- Decision: Paywall offerings failures now show "Plans unavailable right now" with Retry and Restore purchases, while RevenueCat customer status and backend `get-ai-access` remain the access source of truth.
- Decision: Entitlement remains `premium`, offering remains `default`, package IDs and quota/access logic were not changed, and Test Store fallback copy stays in place.
- Validation: `npm run qa:static` and `node scripts/env/validate-env.mjs development` passed; `node scripts/env/validate-env.mjs production` failed as intended on the Test Store key guard until the production RevenueCat key is replaced manually.
- M22D.5F logged production backend/worker smoke-test completion.
- Decision: Production app, production Supabase, deployed Edge Functions, Render worker `recipe-dost-media-worker-prod`, and Gemini pipeline are now validated end to end for anonymous auth plus YouTube, Instagram, and TikTok AI recipe generation.
- Decision: The final production worker blocker was config packaging, not Render env override: the worker Docker image did not include `config/worker.production.json`, so it fell back to defaults until the worker Dockerfile copied `config/` and loaded production config from `/service/config`.
- Remaining blocker: RevenueCat and Google Play subscription setup.
- Next milestone: M22C.3 RevenueCat + Google Play billing setup.
- Validation: `npm run qa:static` passed.
- M22D.2A logged production Supabase project creation and migration smoke-test results.
- Decision: Production Supabase project `cjlvkagkcfswsycsblfw` is safe to document as the production project ref; no secrets, env files, production data changes, or Edge Function deploys were performed by Codex.
- Decision: Production database migrations are marked applied and SQL smoke tests are marked passed based on manual operator results; M22D.3 production worker setup is the next milestone.
- Remaining blockers: production worker URL/shared secret, production RevenueCat values, local-only production env creation, production Supabase secret sync, production Edge Function deploy/smoke tests, and Google Play Billing production setup.
- Validation: `npm run qa:static` passed.
- M22D.2 audited Supabase production readiness and added the production setup runbook.
- Decision: Production Supabase must be a separate project from development project `xvsiuwjidmkdqzkswoki`, with anonymous auth enabled, PostgreSQL 17, migrations applied in committed order, and Edge Function secrets synced only from local-only production env values.
- Decision: No storage bucket is required for the current production setup; any future bucket must come with a dedicated migration and policy review.
- Decision: `get-ai-access` and `sync-revenuecat-entitlement` are required production functions even though they do not yet have explicit blocks in `supabase/config.toml`; deploy them explicitly with JWT verification enabled.
- Validation: `npm run qa:static`, `node scripts/env/validate-env.mjs development`, and `npx supabase --version` passed. Supabase CLI version reported `2.109.1`; the sandboxed `npx` attempt failed DNS resolution, then the approved network run succeeded.
- M22D.1A added explicit app env loading and guarded build scripts.
- Decision: Custom env files are loaded through `scripts/env/run-with-env.mjs`; local Android development should use `npm run dev:android` instead of direct `npx expo start`.
- Decision: Development build scripts validate, sync EAS/Supabase env from the canonical env file, and then run EAS build through the env loader.
- Decision: Production deployment/build scripts are guarded until `env/production.env` exists and refuse the known development Supabase project ref.
- Validation: `npm run qa:static`, `node scripts/env/validate-env.mjs development`, `node scripts/env/run-with-env.mjs development -- npx expo config --json >/dev/null`, and `node scripts/env/deploy-app-env.mjs development --dry-run` passed. Production dry-run guard stopped safely because `env/production.env` is absent.
- M22D.0D rationalized the app repo env/config source of truth before migrating real production values.
- Decision: Canonical mobile env remains limited to actual runtime/build variables; PostHog and Sentry values found in old env candidates stay deprecated until real providers read them.
- Decision: Supabase sync now has required secrets/config plus optional present allowlisted values, while platform-provided Supabase keys and legacy provider branches are not copied into mobile env.
- Decision: `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` remains canonical with temporary fallback support for old `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
- Decision: `env/development.env` was generated locally from old source candidates and remains gitignored; stale public limit envs are rejected and are not canonical.
- Validation: `npm run qa:static`, `npm run env:check`, `APP_ENV=development APP_VARIANT=development npx expo config --json >/dev/null`, `APP_ENV=production APP_VARIANT=production npx expo config --json >/dev/null`, `node scripts/env/validate-env.mjs development`, `npm run env:eas:dev:dry`, and `npm run env:supabase:dev:dry` passed.

## 2026-07-07
- M22D.0C audited app repo env names before real value migration.
- Decision: Canonical app repo env variables are documented in `docs/m22d-env-variable-map.md`; `APP_ANDROID_PACKAGE` was removed from templates because runtime package resolution belongs to `app.config.js`.
- Historical decision (superseded by M24.1D): `SUPABASE_ENV_NAME` was treated as
  an optional local helper label. `SUPABASE_PROJECT_REF` remains required for
  Supabase secret sync; deployed environment selection now uses `RECIPE_DOST_ENV`.
- Decision: Edge Function worker secret lookups now prefer canonical `MEDIA_WORKER_SHARED_SECRET` and retain `WORKER_API_SECRET` / `MEDIA_WORKER_SECRET` as migration fallbacks.
- Validation: `npm run qa:static`, `npm run env:check`, `APP_ENV=development APP_VARIANT=development npx expo config --json >/dev/null`, and `APP_ENV=production APP_VARIANT=production npx expo config --json >/dev/null` passed.
- M22D.0A established local gitignored env files as the app repo source of truth for development and production separation.
- Decision: `env/development.env` and `env/production.env` are not committed; committed `.example.env` files define the required key shape without real values.
- Decision: EAS public/app variables and Supabase Edge Function secrets are synced from allowlisted values only, with masked dry-runs and manual apply commands.
- Decision: Production Play Billing remains paused until production Supabase and worker envs exist.
- Validation: `npm run qa:static`, `npm run env:check`, `APP_ENV=development APP_VARIANT=development npx expo config --json >/dev/null`, and `APP_ENV=production APP_VARIANT=production npx expo config --json >/dev/null` passed.

## 2026-07-06
- M22C.2 cleaned subscription docs/config drift before Google Play internal testing.
- Decision: Launch checklist now uses entitlement `premium`, planned Google Play product IDs, base plan IDs, offering `default`, and the Google Play/RevenueCat subscription_id:base-plan-id note.
- Decision: Prompt metadata examples now use `premium`; `get-ai-access` remains the only app access/quota source of truth.
- Decision: Privacy copy now describes RevenueCat as used for subscription purchase status and subscription management metadata.
- Validation: `npm run qa:static` passed.
- M22C.1 finalized Android package and Play AAB build readiness for Google Play internal testing.
- Decision: Production Android package finalized as `com.recipedost.app`.
- Decision: Added a production EAS profile that builds a Google Play Android App Bundle with `eas build --platform android --profile production`.
- Validation: `npm run qa:static` and `npx expo config --json >/dev/null` passed.
- M22B.3C fixed mounted-state warning risk and added static QA guards for hook order, forbidden copy, unsafe logs, and lifecycle hazards.
- Decision: App patches should run and report `npm run qa:static`; the guard combines typecheck, Expo config, and lightweight source scans.
- Validation: `npm run qa:static` passed.
- M22B.3A prevented Restore/Refresh from incorrectly downgrading Premium on uncertain RevenueCat state. Backend sync now only deactivates Premium on definitive inactive/expired entitlement for the same app user id.
- Decision: Restore now waits for RevenueCat readiness, restores, refreshes CustomerInfo, runs safe backend sync, and refetches `get-ai-access` before showing Free/no-subscription copy.
- Decision: `sync-revenuecat-entitlement` returns safe uncertainty/identity/API error codes without modifying existing active backend Premium on malformed, mismatched, missing, or transient RevenueCat responses.
- Deployment notes: run `supabase functions deploy sync-revenuecat-entitlement`.
- Validation: `npm run typecheck`, `npx expo config --json`, and `npm run functions:check` passed. `functions:check` emitted existing Deno warnings about ignored `ignoreDeprecations`.
- M22B.3 completed monetization/access QA hardening. Settings, Recipe Detail, Paywall, and developer access diagnostics now use backend-first access state for Premium/free display and quota copy.
- Decision: Test Store monetization/access flow is ready for Google Play product setup; M22C is next for real Google Play subscription setup/testing.
- Decision: Premium remains 100 AI recipes/month, Free remains 3 successful AI recipes total, active jobs reserve slots, failed jobs do not count, and videos remain limited to 2 minutes in beta.
- Validation: `npm run typecheck` and `npx expo config --json` passed.

## 2026-07-05
- M22B.2E improved AI extraction failure copy and made Subscription actions plan-aware. Premium users now see Manage / cancel subscription, Restore, and Refresh actions. Cancellation opens store management when managementURL is available.
- Validation: `npm run typecheck` and `npx expo config --json` passed.
- M22B.2C stabilized RevenueCat identity/sync and sticky active AI job UI. Settings no longer flashes Free during backend/local RevenueCat race. Source Detail keeps active job state during refetch gaps and does not fall back to idle Generate while a job is running.
- Decision: RevenueCat restore/status calls now wait for the SDK to be configured for the Supabase user id, and backend Premium access remains authoritative if restore finds no new local purchase.
- Decision: `sync-revenuecat-entitlement` no longer treats malformed RevenueCat subscriber responses as definitive inactive entitlement.
- Deployment notes: run `supabase functions deploy sync-revenuecat-entitlement`.
- Validation: `npm run typecheck`, `npx expo config --json`, and `npm run functions:check` passed. `functions:check` emitted existing Deno warnings about ignored `ignoreDeprecations`.
- M22B.2B unified Settings subscription display with backend get-ai-access. Backend access is now source of truth for plan/quota; RevenueCat local state is used for purchase/restore/manage actions. Fixed Free/Premium mismatch after Expo reload.
- Validation: `npm run typecheck` and `npx expo config --json` passed.
- M22B.2A fixed hook order regression in recipe detail screen after AI job reconciliation patch.
- Validation: `npm run typecheck` and `npx expo config --json` passed.
- M22B.2 AI job state reconciliation, Premium quota display, and AI auto-open fix completed.
- Fixed: Source Detail now writes the created/existing media job returned by `create-media-job` into the latest media-job query cache immediately, so the UI stays in starting/analyzing instead of resetting to idle Generate.
- Fixed: Generate AI Recipe has a local start lock and remains disabled while mutation/start lock/active job is present.
- Fixed: Active jobs discovered on mount/focus mark the flow for auto-open, so completion with `result_recipe_card_id` replaces Source Detail with AI Recipe detail once navigation is ready.
- Fixed: Premium helper text uses backend monthly quota remaining/used values when available.
- Decision: M22B.2 adds no migration and does not change save/share/metadata flow.
- Deployment notes: run `supabase functions deploy create-media-job`.
- Validation: `npm run typecheck` and `npx expo config --json` passed.
- M22B RevenueCat backend entitlement sync and AI quota enforcement completed.
- Decision: M22B uses the existing `user_profiles` RevenueCat mirror fields and adds only optional safe RevenueCat metadata columns (`revenuecat_product_id`, `revenuecat_expires_at`, `revenuecat_store`).
- Decision: `sync-revenuecat-entitlement` is the authenticated server-side sync path. It reads RevenueCat with `REVENUECAT_API_KEY`, does not trust client premium flags, and returns safe entitlement fields only.
- Decision: Backend AI quota enforcement is now the source of truth. Free gets 3 successful AI recipes total; Premium gets 100 successful AI recipes/month; active jobs reserve slots; failed/cancelled jobs do not count.
- Decision: `create-media-job` blocks before inserting a job with specific quota error codes and preserves the 2-minute beta video duration guard for all users.
- Decision: Source Detail handles unsynced local Premium by syncing entitlement and refetching access before retry, and the error card no longer adds a second large Generate AI Recipe button.
- Deferred: RevenueCat webhooks may be added later for store-initiated subscription changes.
- Deployment notes: run `supabase db push`, then `supabase functions deploy sync-revenuecat-entitlement`, `supabase functions deploy get-ai-access`, and `supabase functions deploy create-media-job`.
- Validation: `npm run typecheck`, `npx expo config --json`, and `npm run functions:check` passed. `functions:check` emitted existing Deno warnings about ignored `ignoreDeprecations`.
- M22A.2 Paywall and AI generation CTA UX polish completed.
- Decision: Source Detail AI generation now uses one state-driven CTA area so existing AI recipes show Open AI Recipe, Premium users see Generate AI Recipe with Premium helper copy, free users see remaining free recipes, and exhausted free users see one Upgrade card.
- Decision: Long-video and metadata-pending states do not suggest Premium as the fix; Premium does not increase the 2-minute beta video duration limit.
- Decision: Paywall now uses clearer short copy, compact benefits, selectable monthly/yearly package cards, and one selected-plan Continue CTA while Restore purchases and Maybe later stay visually quiet.
- Decision: RevenueCat Test Store dialogs remain expected during development testing and are not customized by the app paywall.
- Deferred: Server-side Premium monthly quota enforcement remains M22B/M22B.1.
- Validation: `npm run typecheck` and `npx expo config --json` passed.
- M22A.1 Premium UX polish, subscription management, and plan copy correction completed.
- Decision: User-facing subscription copy now uses `Premium` instead of `Pro`, and Premium beta is described as 100 AI recipe cards/month instead of unlimited AI usage.
- Decision: Paywall shows a clean Premium active state with Manage subscription and Close actions, while free users see monthly/yearly plan cards, restore purchases, loading, retry, and unavailable states.
- Decision: Settings shows Free and Premium-specific subscription states. Premium users see Manage subscription, Restore purchases, Refresh status, 100 AI recipe cards/month, 2-minute beta video support, and RevenueCat renewal/access dates when available.
- Decision: Manage subscription opens RevenueCat `customerInfo.managementURL` when available and otherwise shows the friendly test-purchase fallback; the app does not implement direct cancellation or delete the RevenueCat user.
- Deferred: Supabase entitlement sync and real server-side monthly Premium quota enforcement remain M22B/M22B.1; Google Play real subscription testing remains M22C.
- Validation: `npm run typecheck` and `npx expo config --json` passed.

## 2026-07-04
- M22A RevenueCat paywall foundation started and completed.
- Decision: RevenueCat SDK config is centralized in the app with `premium` and `default` fallbacks, and real API keys stay in `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
- Decision: The RevenueCat provider configures only after Supabase auth is available and uses the Supabase anonymous `user.id` as the RevenueCat appUserID.
- Decision: Settings and the paywall use local RevenueCat entitlement state only; Supabase/backend entitlement sync remains M22B, so Premium still needs final server-side monthly quota enforcement.
- Decision: Save/share, metadata preview, library/search, open original, and existing grocery viewing remain free; only Generate AI Recipe opens the paywall after free AI access is exhausted.
- Deferred: Google Play real subscription product setup remains M22C; no Supabase functions, migrations, worker repo, media pipeline, auth/signup, token bundles, lifetime plan, or multi-tier pricing were added.
- Validation: `npm run typecheck` and `npx expo config --json` passed.
- M21.11B/C settings preferences and compliance scaffold started and completed.
- Decision: Add `SUPPORTED_SECONDARY_RECIPE_LANGUAGES` with Urdu as the only supported option, default profile persistence through `user_profiles.secondary_recipe_language_code = 'ur'`, and a nested selector screen instead of hardcoding Urdu across Settings.
- Decision: Generate AI Recipe passes `secondary_recipe_language_code` to `create-media-job`; the Edge Function stores the selected code and instruction in `media_jobs.source_metadata` without changing the worker request contract or Gemini extraction prompt.
- Decision: Privacy & data usage and Delete account & data are nested settings pages with short non-legal copy. Delete account remains a request/contact scaffold; no service-role deletion function was added because the final user-owned data map and public store deletion link should be verified before automation.
- Deferred: Automated delete-account backend and public store deletion link remain M23 before release unless prioritized sooner.
- Deployment notes: run `supabase db push` for `20260704161913_m21_11_secondary_language_preference.sql`, then deploy only the changed function with `supabase functions deploy create-media-job`.
- Validation: `npm run typecheck`, `npm run functions:check`, and `npx expo config --json` passed. `functions:check` emitted existing Deno warnings about ignored `ignoreDeprecations`.
- M21.11A Settings screen redesign started and completed.
- Decision: Settings is now a structured hub with Profile, Subscription, Recipe Preferences, Appearance, Privacy & Data, Support, and Developer sections instead of mixed normal/debug cards.
- Decision: Premium and restore purchases remain friendly placeholders; RevenueCat integration remains M22.
- Decision: Delete account & data remains a placeholder row only; backend deletion remains M21.11C.
- Decision: Developer identity/access tools remain available but are grouped under Developer and gated to `__DEV__`, admin, or tester access only.
- Validation: `npm run typecheck` and `npx expo config --json`.
- M21.10A lightweight agent QA contract docs started and completed.
- Decision: Add concise agent runbook, QA scenarios, milestone status, and compact `AGENTS.md` guardrails now; defer heavy closed-loop QA architecture.
- Reason: Avoid complexity, token burn, and delivery delay before monetization.
- Deferred: Expo MCP setup, React runtime introspection, device/browser visual QA automation, automated self-healing loops, Maestro, serve-sim, and agent-device setup.
- Next: M22 RevenueCat paywall + entitlement sync.
- Validation: Docs-only review with `git diff -- docs AGENTS.md`; no typecheck run.
- Human QA needed: Review the docs before starting M22.

## 2026-07-03
- M21.9C.6 prevents duplicate saved videos by normalizing recipe source URLs, blocking local duplicate optimistic cards, and returning existing recipe_items from save-recipe-link when already saved.
- Decision: The canonical duplicate key is stored as `recipe_items.source_metadata.normalized_source_key` for new saved links; this patch does not add a schema migration or backfill old rows, and `save-recipe-link` compares legacy saved `source_url` values by the same normalizer before inserting.
- Decision: Duplicate saves show "This recipe is already saved.", reuse the existing cached/server item, and do not create `media_jobs`, trigger metadata refresh for the duplicate, or reset existing title/thumbnail/loading state.
- Manual cleanup note: existing duplicate rows were intentionally left untouched; if needed later, inspect candidate duplicates by grouping on `user_id` and `source_metadata->>'normalized_source_key'`, then archive/delete only after manually choosing the canonical row per group.
- M21.9C.5 fixed navigation side-effects to avoid Expo Router mounted warnings, blocked AI generation while metadata is pending/too long, mapped video duration failures to friendly copy, and refreshed AI access after failed jobs.
- Fixed: Source Detail AI auto-open now waits for root navigation readiness, runs after interactions, cancels pending work on unmount, and still navigates only once.
- Fixed: Incoming share-intent modal/error handling is scheduled after interactions and cancels delayed modal/timer work on unmount.
- Fixed: Generate AI Recipe is disabled while metadata is pending/saving/loading/fetching and when recipe/media metadata says the video exceeds the 120-second support limit.
- Fixed: Duration failure codes (`video_duration_exceeded`, `media_duration_exceeded`, `video_too_long`, `duration_exceeded`) now show friendly long-video copy instead of generic AI failure.
- Fixed: Failed media jobs invalidate AI access, media-job, recipe-item, and recipe-card queries so failed jobs do not keep stale active/reserved credit copy.
- Decision: M21.9C.5 remains app-side only; no worker, Supabase Function, thumbnail, native config, modal architecture, RevenueCat, auth, dependency, icon, or splash changes were made.
- M21.9C.4 fixed QA issues: back navigation avoids duplicate Home stack, AI auto-open replaces source detail, detail screens live-refresh metadata, loading cards avoid duplicate Fetching labels, and offline errors preserve cached lists.
- Fixed: Header back uses native stack back when available, then safe `returnTo`/fallback `replace`; Home callers pass `/` as the fallback parent, while Library and Grocery keep route-specific parents.
- Fixed: Source Detail auto-open preserves the incoming parent route and replaces into AI Recipe, preventing back from returning to the old metadata/source screen.
- Fixed: Saved Recipe detail polls active metadata states and refetches on focus; background metadata refresh invalidates the detail query plus Home/Library lists.
- Fixed: Pending metadata cards now show a useful saved-link title/subtitle and a lightweight loading placeholder instead of repeating "Fetching details" in title and status.
- Fixed: Home, Library, and Grocery render cached data through background network errors and only show large retry errors when no cached data exists.
- Decision: M21.9C.4 remains app-side only; no worker, Supabase Function, native config, dependency, RevenueCat, login, or media prompt changes were made.
- M21.9C final core-flow QA freeze completed after focused validation.
- Fixed: Home/Library AI-card filters and grocery affordances now count completed media jobs with `result_recipe_card_id`, matching visible AI Recipe status.
- Fixed: Home/Library visual cards no longer render platform as an extra mini pill; platform remains in subtitle/meta copy and the image keeps one main status pill.
- Fixed: Nested headers honor explicit `returnTo` parents before native back history so source/detail/grocery returns are predictable after replace-based auto-open flows.
- Fixed: Grocery list and usage summary loading now route common network failures through the friendly offline message.
- Deferred: Native Android share-intent behavior and full device acceptance still need human QA on a development APK.
- Decision: M21.9C is a QA freeze only; no RevenueCat, auth, worker changes, media prompt changes, schema changes, or new dependencies were added. The app is ready for M21.10A agent QA contract if acceptance passes.
- M21.9C.3 fixed nested header back behavior to prefer router.back() and route-specific returnTo fallbacks. Grocery cards now reuse the Library thumbnail fallback chain.
- Decision: Parent screens pass `returnTo` when opening nested details; the nested header now treats that explicit parent as the preferred destination.
- Decision: Source Detail auto-open keeps `router.replace` behavior but carries a Source Detail `returnTo` so direct fallback navigation remains useful.
- Decision: Grocery list cards are enriched app-side from existing `media_jobs` and `recipe_items.thumbnail_url` data; no schema, worker, thumbnail generation, or Supabase Function changes were made.
- M21.9C.2 replaced custom Back pill headers with a standard nested-screen header.
- Decision: Tab roots have no back header; nested/detail screens have safe back navigation through the compact `NestedScreenHeader`.
- Decision: Source/AI detail screens support compact optional open-original right actions using existing source-opening handlers; no new delete/options menu was added because no existing delete action is present in these screens.
- Decision: Grocery detail uses a simple back arrow plus "Grocery List" title and no right-side action.
- M21.9C.1 audited navigation headers. Main tab roots have no back header; nested/detail screens have visible back navigation with safe fallback.
- Decision: The tab group remains `headerShown=false` for Home, Library/Saved Links, Grocery root, and Settings to avoid duplicate headers above the fixed bottom tab bar.
- Decision: Saved Recipe/Source Detail, AI Recipe detail, and recipe-specific Grocery List use a shared in-screen `ScreenHeader` so the back control can fall back to `/library` or `/grocery` when `router.canGoBack()` is false.
- Decision: The grocery tab route is intentionally query-param based for MVP; `/grocery` renders the root list without a back button, while `/grocery?recipeCardId=...` renders the nested grocery checklist with a back header.
- M21.9B.1A preserves safe thumbnail trace fields in recipe_items.source_metadata.
- M21.9A.4 fixed Save Recipe BottomSheet keyboard behavior using BottomSheetTextInput, tall snap points, keyboardBehavior=extend, and coordinated keyboard+sheet close.
- M21.9A.3 fixed BottomSheet keyboard behavior by using BottomSheetTextInput, dismissing keyboard before sheet close, and synchronizing close state via onDismiss.
- M21.9A.2 replaced the custom Save Recipe URL modal with a stable `@gorhom/bottom-sheet` `BottomSheetModal`.
- Decision: The app root is wrapped once with `GestureHandlerRootView`, with one `BottomSheetModalProvider` near the root and one global Save Recipe sheet instance in `SaveRecipeModalProvider`.
- Decision: Backdrop tap, Android hardware back, and the X close button are the supported Save Recipe sheet close methods.
- Decision: Swipe-to-close and sheet panning are disabled for the MVP to avoid Android keyboard gesture glitches.
- Decision: Shared URL prefill, invalid-share messaging, optimistic save, and background metadata refresh behavior remain on the existing provider flow.
- Decision: Native bottom sheet/gesture behavior requires a fresh development build before device QA.
- M21.9A.1 stabilized Save Recipe modal behavior.
- Decision: Save Recipe uses a built-in full-screen transparent Modal with an absolute dark backdrop and a bottom-anchored sheet to avoid detached shadows, gaps, and backdrop layering issues.
- Decision: Swipe-to-close is disabled for the MVP because backdrop tap, Android back, and X close are more reliable with the Android keyboard open.
- Decision: Closing the modal clears initial URL/share hint state while preserving the existing optimistic save plus background metadata refresh flow.
- Blocker: M21.9A.1 validation stopped after `npm run typecheck` failed with `app/_layout.tsx(9,32): error TS2322: Type '{ style: "light"; translucent: boolean; }' is not assignable to type 'IntrinsicAttributes & StatusBarProps'. Property 'translucent' does not exist on type 'IntrinsicAttributes & StatusBarProps'.`; `npx expo config --json` was not run because validation stopped on the first failure.

## 2026-07-02
- M21.9A AI queue reservation and detail polish completed.
- Decision: Successful AI jobs count permanently, while active queued/analyzing jobs reserve free slots temporarily and release them if they fail or stop before producing a result.
- Decision: Source Detail may auto-open an AI recipe result only when generation was started from that detail screen in the current session.
- Decision: Save modal backdrop/outside close, visible detail headers, status-bar safe layout, and friendly retry copy are polish changes only; save/share still uses `save-recipe-link` plus `refresh-recipe-metadata` and does not create `media_jobs`.
- Decision: Network failures should show "You seem to be offline. Check your internet and try again." with retry UI instead of Java/fetch exception text.
- Blocker: M21.9A validation stopped after `npm run typecheck` failed with `app/_layout.tsx(11,9): error TS2322: Type '{ style: "light"; backgroundColor: "#050505"; translucent: boolean; }' is not assignable to type 'IntrinsicAttributes & StatusBarProps'. Property 'backgroundColor' does not exist on type 'IntrinsicAttributes & StatusBarProps'.` and `src/features/media-jobs/media-job-card.tsx(75,15): error TS2322: Type 'string | undefined' is not assignable to type 'string'. Type 'undefined' is not assignable to type 'string'.`; `npx expo config --json` was not run because validation stopped on the first failure.
- Fixed M21.8C.1 share intent render loop by avoiding idle state updates when no share intent exists.
- Updated visible app name to Recipe Dost while preserving slug/package.
- M21.8C share/save visual polish and splash config completed.
- Decision: Normal app launch must remain idle on Home; share errors are shown only after an actual native share payload is received and cannot be parsed into a supported URL.
- Decision: Save modal opens only from the plus button or a valid shared URL, clears shared initial state on close, and uses Android resize plus scrollable content to stay above the keyboard.
- Decision: Optimistic save cards use `optimistic:<normalizedUrl>` and normalized `source_url` so server recipe_items replace the optimistic item instead of rendering duplicates.
- Decision: Background recipe-list refetch is silent after initial load; no fetched/fetching status card should appear during metadata refresh.
- Decision: Display mapping continues to prefer AI recipe title and summary over source metadata after recipe generation, without overwriting source URLs or source metadata.
- Decision: Splash/icon config now uses `assets/images/*` and requires a rebuilt dev APK to verify native splash changes.
- M21.8B Android share payload and save UX polish completed.
- Decision: Android share intake now uses `expo-share-intent` to read native shared text/web URLs on cold start and resume; the existing manifest share filters remain for Android share-sheet visibility.
- Decision: Share/save remains a free saved-link flow through `save-recipe-link` plus background `refresh-recipe-metadata`; only `Generate AI Recipe` can create `media_jobs` or spend AI generation access.
- Decision: The save modal closes immediately after a valid submit and writes an optimistic Saving card to Home/Library caches; failures remove the optimistic item and show a friendly retry banner.
- Decision: AI recipe cards override vague source metadata titles/summaries in user-facing cards and saved-link detail after generation completes, while preserving original source URL/metadata.
- M21.8A EAS Android development build setup completed.
- Decision: Android share-to-app testing now uses `expo-dev-client` and internal APK EAS profiles because Expo Go is not a reliable target for native Android share intents.
- Decision: The app uses temporary development package `com.recipedost.dev` until a production Android package name is finalized.
- Decision: Native config changes such as Android share intent filters or package IDs require rebuilding and reinstalling the development APK or local native build before testing.
- M21.8 Android share-to-app modal save completed.
- Decision: Android share intake accepts text share intents and may require a development build/APK for full testing; Expo Go is not a reliable validation target for receiving Android share intents.
- Decision: Share intake extracts only supported Instagram, TikTok, YouTube, Facebook, and `fb.watch` HTTP(S) URLs, then opens the existing Save Recipe modal prefilled with the URL and a "Shared from another app" hint.
- Decision: Shared saves use the same `save-recipe-link` plus background `refresh-recipe-metadata` flow as manual modal saves, so sharing/saving does not create `media_jobs`, call AI, or consume credits.
- Decision: `save-recipe-link` handles same-user duplicate normalized URLs by returning the existing saved item, with the client cache also filtering by `source_url`.
- Decision: `Generate AI Recipe` remains the only user-facing path that calls `create-media-job` and spends AI generation access.

## 2026-07-01
- M21.7G metadata-preview payload contract fix completed.
- Decision: The worker `/metadata-preview` contract is `{ url, platform }`; `refresh-recipe-metadata` must never send `source_url` to the worker or call it with a missing/invalid URL.
- Decision: Edge 422 responses from the worker are treated as `worker_validation_error`, are not retried, and store only safe metadata error fields. Safe logs may include URL presence, length, and host, but never the full source URL or query string.
- Decision: Saved-link metadata failure remains non-blocking and does not create a `media_job`; failed metadata renders as a usable Saved Link with retry details and AI generation still available through backend access checks.
- M21.7F metadata bridge warmup and saved-link state polish completed.
- Decision: Direct worker `/metadata-preview` success means Edge Function 503s should be handled as bridge/cold-start conditions; the bridge now performs best-effort `/ping`, retries timeout/502/503/504 once with backoff, and records safe `attempts` metadata.
- Decision: Metadata refresh failure remains separate from AI generation failure. Failed metadata keeps the saved link usable, keeps `Generate AI Recipe` available behind `get-ai-access`/`create-media-job`, and stores only safe `metadata_error` fields.
- Decision: Home/Library saved-link cards show one top status pill and a clean RD placeholder; platform appears in the card metadata row instead of competing with the status pill.
- Decision: The share-intent route now uses `save-recipe-link` plus `refresh-recipe-metadata`; old `parse-url`/preview remains legacy/internal and is not part of the current visible saved-link flow.
- M21.7E metadata bridge fix and saved-link UI cleanup completed.
- Decision: `refresh-recipe-metadata` uses `MEDIA_WORKER_URL` plus `Authorization: Bearer WORKER_API_SECRET`; `MEDIA_WORKER_SECRET` remains a temporary fallback only.
- Decision: Metadata preview timeout defaults to `25000` ms and retries once only for timeout/502/503/504. Client errors such as 400/401/403/404 are not retried.
- Decision: Saved-link `source_metadata` stores only safe metadata fields and a sanitized `metadata_error`; full source URLs, thumbnails, CDN/video URLs, cookies, secrets, temp paths, Gemini file URIs, and raw worker responses are excluded.
- Decision: Metadata failure is not an AI generation failure. Home/Library continue to show the saved link as usable, with `Details unavailable`; only failed `media_jobs` show AI failure.
- Decision: AI free generation count is controlled by `FREE_AI_GENERATION_LIMIT` in Edge Function env, with fallback `3`.
- M21.7 Worker metadata + modal save UX completed.
- Decision: The center plus opens a modal bottom sheet for URL-only saving; the old full add/preview flow is no longer reachable from the primary save action.
- Decision: The modal calls `save-recipe-link`, updates Home/Library caches immediately, then starts `refresh-recipe-metadata` in the background without creating `media_jobs`.
- Decision: Home and Library cards use plain user-facing states: Fetching details, Saved Link, Analyzing, AI Recipe, and Failed.
- Decision: Source Detail exposes one AI creation CTA, `Generate AI Recipe`; all user-facing generation now routes through `create-media-job`.
- Decision: Modal and card analytics use event names without source URLs, CDN URLs, worker secrets, or raw metadata.
- M21.7B Supabase saved-link and worker metadata bridge completed.
- Decision: `save-recipe-link` is the free saved-link creation contract and never creates `media_jobs`, calls AI, or consumes AI credits.
- Decision: `refresh-recipe-metadata` is the only app-facing metadata refresh contract; it calls the protected worker `/metadata-preview` endpoint from Supabase Edge Functions using server-only secrets.
- Decision: Worker metadata stored on `recipe_items.source_metadata` is limited to safe fields such as title, description, platform, thumbnail, author, duration, resolver, and source URL. CDN URLs, cookies, temp paths, Gemini file URIs, raw worker responses, and secrets are not stored.
- Decision: `create-media-job` may accept `recipe_item_id` and uses the saved URL/platform after ownership verification, but still enforces AI generation access before inserting a job.
- M21.6 UX flow simplification completed with backend `get-ai-access` as the visible AI credit source of truth.
- Decision: Saved links, metadata preview, library, and grocery viewing are unlimited for MVP; only successful AI recipe generation is limited.
- Decision: Saved-link detail exposes one AI CTA, `Generate AI Recipe`, and it queues `create-media-job` so credit checks stay server-side.
- Decision: The legacy direct `generate-card` helper remains internal but is no longer user-facing from saved-link detail.
- Decision: Free-limit errors show the "Free AI recipes used" upgrade placeholder; generic media-job errors still show retry.
- Decision: Recipe-card production UI hides model, source-mode, and confidence/debug badges; low-confidence warnings appear only for low and sparse cards.
- M21.5 dev identity switcher and AI access QA tools added without full paywall, signup UI, token bundles, or mobile role mutation.
- Decision: Dev identity switching is limited to anonymous Supabase sessions saved locally on the device; the app cannot impersonate arbitrary user IDs.
- Decision: Role, tester, and premium simulation stays SQL-only. The mobile dev panel only copies IDs, creates fresh anonymous users, switches saved local sessions, and reads safe access state.
- Decision: `get-ai-access` shares the server-side access helper with `create-media-job` and returns only safe entitlement/usage fields.
- M21 monetization/account foundation added without full paywall, signup UI, token bundles, or Play Store release changes.
- Decision: Recipe Dost remains anonymous-first; Supabase anonymous `user_id` is the primary app user ID and the future RevenueCat `appUserID`.
- Decision: The premium entitlement key is `premium`, mirrored on `user_profiles` for server-side access decisions.
- Decision: Free users get 3 lifetime successful AI media generations; failed jobs and non-AI jobs do not consume credits.
- Decision: Premium users get 60 successful AI recipes per month for MVP fair use, testers default to 100/month unless overridden, and admins use a high operational limit.
- Decision: `create-media-job` enforces AI generation access before inserting a queued job, preserving queue wake behavior only after access is allowed.
- Decision: Monetization role, tester, override, and RevenueCat mirror fields on `user_profiles` are protected from mobile-client mutation by a database trigger.

## 2026-06-27
- M19 App E2E polish completed for preview metadata, live media-job metadata, completed result routing, Urdu display, and recipe-card consistency.
- Decision: URL preview remains best-effort; failed metadata fetches fall back to platform + URL placeholders and do not block saving.
- Decision: App preview metadata comes through Supabase Edge Functions only; the mobile app does not call worker endpoints directly or handle secrets.
- Decision: Recipe result screens render normalized recipe JSON defensively, derive grocery rows from ingredients when grocery JSON is empty, and use only `missing_info_json` for Missing details.
- Decision: Video analysis is presented as limited to 2 minutes; over-limit previews/errors show friendly guidance instead of raw backend codes.
- M17B explicit queue processor mode completed for `create-media-job`.
- Decision: `MEDIA_PROCESSOR_MODE=queue` inserts queued media jobs for the Render polling worker and does not POST `/process-job`.
- Decision: queue mode performs a best-effort short GET `{MEDIA_WORKER_URL}/wake` using `WORKER_WAKE_TIMEOUT_MS` defaulting to 2500 ms, and job creation succeeds even if wake fails.
- Decision: queue wake events store only processor mode, status code when available, and timeout; worker URLs are not stored in job events.
- A-M15C Real source metadata display completed for media job status cards, completed recipe results, and existing visual recipe cards.
- Decision: The app reads only `media_jobs.source_metadata` for public source details and does not query `media_job_private_metadata`.
- Decision: UI renders only whitelisted fields: title, description, platform, resolver, duration, uploaded thumbnail, and media size; CDN URLs and raw JSON are never displayed.
- Decision: Mock recipe result labeling is limited to subtle dev/status context while real source metadata remains visible.
- A-M15B Public source metadata + private processing metadata schema completed with a migration adding `media_jobs.source_metadata` and `media_job_private_metadata`.
- Decision: `media_jobs.source_metadata` stores safe app-visible source metadata only.
- Decision: `media_job_private_metadata` stores CDN URL and raw resolver metadata for backend worker processing only.
- Decision: CDN URLs are not displayed in the app and are not stored in `media_jobs.source_metadata`.

## 2026-06-20
- Project created as Expo React Native + TypeScript app.
- Backend selected: Supabase Auth + Postgres + Edge Functions.
- App direction: Android-first, link-first AI recipe organizer.
- Compliance rule: save links, notes, metadata, and AI recipe cards only. Do not download videos.
- Free plan: 20 saved links, 3 AI recipe cards, 3 grocery lists.
- Paywall trigger: after first successful AI recipe card and after free usage limits.
- Development method: use ChatGPT for planning and Codex for repo changes.
- Initial Supabase schema migration added for auth.users-backed profiles, recipe links, AI recipe cards, collections, grocery lists, usage counters, subscriptions, metadata logs, and support tickets.
- RLS baseline: authenticated users can access only rows where user_id equals auth.uid(); service-role Edge Functions remain responsible for AI generation, usage enforcement, subscription sync, and metadata logging.

## 2026-06-21
- Milestone M1 app foundation added with Expo Router routes for welcome, onboarding, home, library, grocery, settings, save recipe, and paywall.
- Root providers added for TanStack Query, i18n, PostHog placeholder tracking, and Sentry placeholder wrapping.
- Theme tokens and reusable UI primitives added for buttons, cards, inputs, text areas, empty states, error states, and loading states.
- Development telemetry decision: Sentry, PostHog, and RevenueCat are not initialized in development to avoid accidental quota usage; production setup will be handled in a later milestone.
- Milestone M2 Supabase client added using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` only, with React Native session persistence via SecureStore.
- Anonymous auth bootstrap added on app startup: existing sessions are reused, otherwise a guest session is created; loading and retryable error states are shown during startup.
- Auth scope decision: email/social login and service-role keys remain excluded from the mobile app.
- Milestone M3 onboarding flow built with Welcome, Cooking Style, Preferred Language, Household Size, Cooking Level, and Main Use + Optional Preferences screens.
- Onboarding profile now persists locally with Zustand/SecureStore and upserts to Supabase `user_profiles`; `onboarding_completed` is set only after a successful finish.
- Added migration for `user_profiles.cooking_preferences` so optional preference chips are stored instead of ignored.
- Onboarding analytics placeholders added for `onboarding_started`, `onboarding_step_viewed`, `onboarding_option_selected`, `language_selected`, and `onboarding_completed` without sending sensitive freeform data.
- Next action: build M4 Home Dashboard before the Save Link flow.

## Current Build Plan Alignment
- Canonical milestone order confirmed.
- M1 = App Foundation.
- M2 = Supabase Client + Anonymous Auth.
- M3 = Onboarding.
- Previous naming conflict corrected where older plan used M2 for Onboarding.
- Going forward, every milestone must first update screen/API spec, then Codex builds only that milestone.
- Milestone M4 Home Dashboard completed with greeting, promise card, compliance note, how-it-works steps, recent recipe query, empty/loading/error/retry states, and quick actions.
- Save Recipe Link now routes to an M5 placeholder only; no Save Link form, AI generation, Edge Functions, paywall, RevenueCat, share intent, or grocery list generation was added.
- Home analytics placeholders added for `home_viewed`, `home_primary_cta_clicked`, and `recent_recipe_clicked` without sending source URLs or user notes.
- Milestone M5 Save Link + Preview completed with URL validation, local platform detection, local persisted draft storage, Preview & Add Note fields, and safe next-step placeholder.
- No Supabase `recipe_items` insert, `parse-url` Edge Function, AI generation, paywall, RevenueCat, share intent, video download, backup, or scraping was added.
- Save Link analytics placeholders added for `link_pasted`, `link_validation_failed`, `recipe_save_preview_viewed`, and `recipe_link_draft_saved` without sending URLs, captions, notes, or ingredients.
- M5 runtime fix: added Expo scheme `recipe-dost`, hardened the PostHog placeholder provider to stable no-op context methods, and guarded Preview against missing or invalid draft URLs.
- Milestone M6 `parse-url` Edge Function completed with CORS, POST/OPTIONS handling, friendly JSON validation errors, URL normalization, and platform detection.
- M6 returns safe fallback metadata only: `metadata_status = failed`, manual caption required, and null title/description/thumbnail.
- No scraping, video download, private-page fetch, platform bypass, DB insert, DB logging, AI generation, mobile integration, paywall, RevenueCat, or share intent was added.
- Milestone M7 connected Save Link to the deployed cloud `parse-url` Edge Function.
- M7 saves `recipe_items` rows from Preview using the authenticated Supabase mobile client and RLS, then routes to a saved-link placeholder.
- Home recent recipes now refresh after a successful save and can open the saved-link placeholder.
- M7 kept the scope to links, notes, safe fallback metadata, and `recipe_items`; no AI generation, `recipe_cards` insert, video download/backup, scraping, paywall, RevenueCat, or Android share intent was added.
- Fixed the PostHog placeholder provider runtime warning by making it a pure static no-op context with no state, effects, memoization, provider-side tracking, or async work.
- Confirmed the M7 `recipe_items` insert works and remains the current save path.
- Confirmed `title = null` and `metadata_status = failed` are expected until safe metadata providers or AI title generation are added.
- Milestone M8 mock `generate-card` completed with authenticated Edge Function handling, recipe ownership checks, mock card generation, and safe CORS.
- M8 `recipe_cards` insert/update works with deterministic mock data using `model_used = mock`, `prompt_version = mock-v1`, zero token usage, and zero estimated cost.
- The saved recipe placeholder now has a minimal "Generate Mock Recipe Card" trigger and success/error/loading states.
- Real AI generation is deferred to M10.
- Full recipe result UI is next as M9.
- No video download, scraping, paywall, RevenueCat, or Android share intent was added in M8.
- Deno function validation fixed for Supabase Edge Functions.
- Added `supabase/functions/deno.json` and updated function check/format scripts to use it.
- M8 mock `generate-card` behavior remains unchanged.
- Milestone M9 Recipe Result Screen completed at `/recipe-card/[id]`.
- M9 displays existing mock `recipe_cards` data with summary, timing, ingredients, steps, grocery list, substitutions, storage/safety, missing details, and source-link actions.
- Real AI generation remains deferred to M10.
- No paywall, video download, backup, scraping, RevenueCat, or Android share intent was added in M9.
- Milestone M10 real `generate-card` integration completed in the Supabase Edge Function.
- M10 uses the OpenAI Responses API with strict structured JSON output and stores cards with `prompt_version = recipe-card-v1`.
- AI input is limited to saved captions, notes, manual ingredients, safe metadata, and the source link as a reference only; no scraping, video download, platform fetch, or watched-video claim was added.
- Mobile generation copy now says "Generate Recipe Card" with "Creating your recipe card..." loading text and friendly errors for missing OpenAI config, free limit, invalid AI output, and generic failures.
- The 3 free recipe card behavior is preserved, paywall/RevenueCat remains deferred to M14, and no Android share intent or grocery list generation was added.
- M10 `generate-card` was refactored to a provider-based AI adapter system with `AI_PROVIDER = mock | gemini | openai | openrouter | kimi | anthropic`.
- Default development provider is Gemini using `GEMINI_API_KEY` and `GEMINI_MODEL`; mock remains available for offline/no-cost testing.
- OpenAI, OpenRouter, Kimi, and Anthropic are selectable through Supabase Edge Function secrets only; no AI keys were added to the mobile app.
- Provider adapters normalize output into the same `recipe_cards` shape before DB insert/update.
- No scraping, video download, deleted-video backup, paywall, RevenueCat, Android share intent, or M11 library/search work was added.
- `FREE_RECIPE_CARD_LIMIT` is now configurable for `generate-card`; development can use a higher limit for AI provider testing, and production can return to `3` before the paywall milestone.
- Milestone M11 Library + Search completed at `/library`.
- Users can browse saved links and generated recipe cards, search across titles/notes/captions/manual ingredients/platform/cuisine/meal type, filter by status/platform, sort by date, and reopen saved-link or recipe-card detail screens.
- M11 search and filters are client-side over the authenticated user's fetched data for the MVP.
- No paywall, RevenueCat, video download, scraping, deleted-video backup, Android share intent, or M12+ work was added.
- Milestone M12 Grocery List completed at `/grocery?recipeCardId=[recipe_card_id]`.
- M12 uses existing `recipe_cards.grocery_list_json`, with a defensive `ingredients_json` fallback when grocery items are unavailable.
- Grocery checklist state is local-only for the MVP and is not persisted to Supabase yet.
- Recipe Result now exposes "View Grocery List" when a card has grocery items or ingredients.
- No AI call, grocery delivery integration, paywall, RevenueCat, scraping, video download, video backup, deleted-video backup, Android share intent, or multi-recipe meal planning was added.
- Milestone M13 Usage Limits Foundation completed.
- Saved links, recipe cards, and grocery lists now have configurable free-plan limits with mobile defaults of 20, 3, and 3.
- Mobile displays remaining usage on Home, Save Link/Preview, Recipe Detail, and Grocery List.
- Saved-link inserts are blocked before `recipe_items` insert when the free saved-link limit is reached.
- AI recipe card limits remain enforced server-side in `generate-card` through `FREE_RECIPE_CARD_LIMIT`, with mobile usage display as guidance.
- RevenueCat/paywall remains deferred to M14.
- No token bundles, subscription entitlement logic, video download, backup, scraping, deleted-video backup, grocery delivery, or multi-recipe meal planning was added.
- Milestone M14 UI/UX Redesign + Navigation Polish completed.
- The app now uses a warmer food-friendly visual system, shared app headers, section headers, improved cards/buttons/badges, and a simple bottom navigation surface for Home, Library, Grocery, and Settings.
- Home, Save Link/Preview, Library, Recipe Detail, Recipe Result, Grocery List, and Settings were polished without changing working Supabase or AI provider flows.
- RevenueCat/paywall moved later until auth and polished UX are ready.
- Basic organizer features remain free and friendly: saved links, library, search, source links, notes, and captions.
- AI features will be monetized after free tries: AI recipe cards, AI summaries, AI grocery generation, and regenerate/improve actions.
- No video download, video backup, scraping, deleted-video backup claims, schema changes, sign-in/sign-up, or RevenueCat integration were added.
- Milestone M14B Competitor-Inspired UI Upgrade completed.
- The app now uses a warm dark visual system with charcoal surfaces, mint primary actions, orange accent actions, subtle dark borders, compact badges, and reusable filter chips.
- Home, Save Link/Preview, Library, Saved Link Detail, Recipe Result, Grocery List, and Settings were polished using patterns inspired by Save It Later, Saver, and Fofo while keeping the existing Expo Router structure.
- Library now has compact status/platform/sort filters, timeline grouping, richer Saved Link/AI Card cards, note/caption indicators, and clearer empty/no-result states.
- Recipe result now feels more premium with a warm hero card, confidence and metadata badges, compact time/serving chips, distinct Urdu/Roman Urdu tips, and warning-styled missing details.
- Settings is organized into Account, Plan, App, Support, and development-only sections without adding auth, paywall, RevenueCat, or entitlement behavior.
- M14B did not change Supabase schema, AI provider logic, generate-card behavior, usage-limit enforcement, video handling, scraping policy, or backend flows.
- Milestone M14C FoFo-style visual shell completed.
- Recipe Dost moved from a text-heavy prototype layout to a darker, media-first saved-content UI with compact chips, visual cards, and stronger hierarchy.
- Fixed bottom navigation now sits outside scroll content and includes a prominent central Save action that opens the Save Recipe route.
- Home now uses compact brand copy, horizontal chips, a get-started progress card, compact usage stats, and a 2-column visual recipe grid.
- Library now uses compact search/filter chips and a 2-column visual recipe grid while preserving existing search/filter/open behavior.
- Grocery tab now opens a grocery index of available recipe-card grocery lists instead of a not-found detail state.
- Saved-link detail, recipe result, Save Link, Preview, and Settings received media-first layout polish without changing app behavior.
- Basic organizer features remain free and friendly; AI monetization remains later.
- No video download, video backup, scraping, deleted-video backup claims, auth, RevenueCat/paywall, schema changes, or AI provider changes were added.
- Milestone M14D App Shell, Share Intake, Visual Cards, and Urdu/English Preferences completed.
- Fixed tab navigation to real Expo Router `Tabs` behavior with tab screens under `app/(tabs)` and hidden tab headers.
- Added a custom fixed bottom tab bar with Home, Library, central Save action, Grocery, and Settings; tab switching no longer relies on stack pushes.
- Added Android text/link share-to-app intake with `/share-recipe` and `+native-intent`; share intake may require a development build and keeps paste-link fallback.
- Visual recipe cards now support safe fallback visuals and non-persistent YouTube thumbnail derivation without scraping or local media storage.
- Added local persisted Recipe Content Language preference for English, اردو, or Both.
- Recipe Result and Grocery List screens now respect English/Urdu/Both display preferences, including RTL Urdu rendering and language-aware Copy List.
- Updated `generate-card` prompt/schema and mock output to produce Urdu script fields instead of Roman Urdu for new recipe card content while keeping old cards readable.
- No sign-in/sign-up, RevenueCat/paywall, schema migration, video download, video backup, scraping, private saved folder import, or medical/diet/calorie/allergy/weight-loss claims were added.
- Milestone M14E Language, Media Metadata, Share Accuracy, Multi-select Filters, and Safe-Area Fixes completed.
- M14E fixed global safe-area clipping by applying top inset padding through shared screen layout and keeping the fixed bottom navigation above bottom insets.
- M14E added multi-select Home and Library content filters; All clears filters, while Newest and Oldest remain single-select sort controls.
- M14E improved safe thumbnails with YouTube thumbnail URL extraction and fallback visuals for cards without thumbnails.
- M14E added a prominent Open Original Video CTA on saved-link detail and clarified that Recipe Dost saves links and recipe cards, not video files.
- M14E fixed language preference rendering so Urdu mode uses Urdu script with RTL styling and old cards fall back instead of showing Roman Urdu as Urdu script.
- New generated cards request Urdu script fields for top-level text, ingredients, steps, grocery items, storage/safety notes, and missing info; legacy text columns continue storing English for DB compatibility.
- Existing old cards may need regeneration for full Urdu script support.
- AI accuracy depends on caption/manual ingredients and safe public metadata; URL-only inputs should be low-confidence with missing-info warnings.
- Public YouTube video understanding with Gemini remains a future AI accuracy milestone; no Instagram/TikTok/Facebook video download or scraping was added.
- Milestone M14F AI Source Accuracy + Model Selection completed.
- Gemini model selection is controlled by Supabase Edge Function secrets: `GEMINI_MODEL` defaults to `gemini-3.5-flash`, and `GEMINI_VIDEO_MODEL` defaults to `GEMINI_MODEL`.
- AI generation now classifies and stores `text_only`, `youtube_url`, `uploaded_video`, or `unsupported_video_link` source mode in the existing recipe-card metadata JSON.
- Public HTTPS YouTube URLs may use Gemini video understanding through the Gemini Interactions API with `store: false`; `model_used` records the actual text or video model called.
- Instagram, TikTok, and Facebook links are never downloaded, scraped, or treated as watched-video input.
- Accurate non-YouTube social recipe generation requires user-provided caption, visible ingredients, or useful notes; empty unsupported links return `insufficient_recipe_input` before model tokens are spent.
- Provider prompts and server guardrails prevent URL/platform-only inputs from producing a confident specific recipe.
- Future user-owned/authorized video support is deferred to a temporary Supabase Storage upload plus media worker or Gemini Files API flow that deletes raw video after analysis.
- Video-frame thumbnail extraction is deferred to that worker; Edge Functions continue using derived YouTube thumbnails, safe Open Graph image URLs, or visual fallbacks and never fetch video files.
- Milestone M14G-1 Media Job Foundation added `media_jobs` and `media_job_events` with server-controlled writes and user-owned read policies.
- Supabase Edge Functions create media jobs but do not process, download, transcode, thumbnail, upload, or analyze video.
- The worker/downloader is not implemented yet; without `MEDIA_WORKER_URL`, new jobs remain safely queued.
- Raw media is not stored in M14G-1. Storage path, Gemini file, duration, and size columns are future-worker placeholders only.
- Media jobs support a future Cloud Run media worker that receives only a job ID, uses server credentials, writes progress/events, and deletes temporary authorized media after processing.
- Saved-recipe detail polls active media jobs every 6 seconds and stops on completed, failed, or needs-caption states.
- Home and Library show latest processing state through existing visual recipe cards without changing the save or AI generation flows.
- M14G-2 hardened `create-media-job` worker triggering with an awaited 8-second Cloud Run request to `/process-job` using the server-only `MEDIA_WORKER_SECRET`.
- Media job creation now records `media_job_created`, worker trigger start, success, failure, timeout, or skipped-config events so queued jobs are debuggable from `media_job_events`.
- Worker configuration or invocation failures do not fail the mobile request after a job is created; the response reports `worker_triggered: false` and leaves the job queued.
- No video download, Gemini call, FFmpeg, yt-dlp, Apify, auth, paywall, or mobile behavior changes were added in this worker-trigger reliability patch.
- A-M14R1 local/Render worker testing uses `MEDIA_PROCESSOR_MODE=manual` on `create-media-job` to insert media jobs without auto-triggering the old Cloud Run worker. `MEDIA_PROCESSOR_MODE=worker` remains the default and preserves the Cloud Run trigger path; `disabled` also bypasses triggering. Skipped triggers record `worker_trigger_skipped` when possible and never expose worker secrets.
- M14G-3 app integration completed.
- YouTube media jobs can now become recipe cards in the app when the worker publishes `result_recipe_card_id`.
- Completed jobs show "Recipe card ready" and open the generated recipe result.
- Active job views poll every 5 seconds and stop for completed, failed, or needs-caption states.
- Home and Library prefer worker thumbnails, refresh while jobs are active, and recognize completed worker results as AI cards.
- Non-YouTube jobs still need caption or manual ingredient input when the public link cannot provide accurate recipe content.
- No raw video download, mobile video storage, scraping, auth, or paywall behavior was added.

## [2026-07-01] Architectural Decision: Graph Indexer Removal

- **Context:** Automated AST graph generators (Graphify/CodeGraph) were causing infinite self-correction loops due to macOS sandbox permission conflicts (`Errno 1`). This was expanding the active context window with 40k+ line JSON data logs, exhausting session limits inside a single task block.
- **Decision:** Completely uninstalled Graphify, wiped `graphify-out/` and `.code-review-graph/`, and removed the MCP server configuration.
- **Consequence:** Project context tracking is now 100% shifted back to lightweight, cost-free, explicit markdown files (`agents.md`, `todo.md`, `decision_log.md`). Codex must rely purely on target file blocks provided directly in user prompts.

## [2026-07-30] M24.7C Recipe Duration and Active Queue Discovery

- Added one authoritative frontend recipe-duration selector. Prep plus cook corrects a conflicting explicit total; ambiguous legacy seconds and source-video duration never become recipe time.
- Home now queries up to 10 canonical active media jobs separately, orders processing before queued FIFO, and renders them in a horizontal `In progress` gallery above completed `Recent`.
- Terminal jobs leave the active cache on the next 5-second poll and invalidate only active jobs, recent recipes, Library, and linked recipe/card keys. Focus and foreground refresh both active and recent data.
- Library Recent uses one platform-neutral display comparator: processing, queued FIFO, retryable failure, completed by newest terminal/update time, then other failures.
- Active placeholders are excluded from Home Recent by recipe-item and result-card linkage, and duplicate completed result cards are collapsed by recipe-card ID.
- No migration, schema, Edge Function, worker, queue, Gemini, provider, quota, dependency, RevenueCat, or deployment behavior changed.
- Validation: `npm test`, `npm run typecheck`, `npm run lint`, `npm run qa:static`, and `npm run functions:check` passed. `npm run doctor` reported only the accepted existing Expo package-drift warning.

## [2026-07-30] M24.5R Same-Account Recovery

- Anonymous accounts are secured in place with Supabase `updateUser`, email-change OTP verification, and a password; every step verifies that the original Supabase user ID is unchanged and never calls `signUp`.
- Recovery uses email/password sign-in, verifies the final Supabase session, clears/refetches only user-owned query roots, and never inserts, migrates, merges, or deletes recipe/media data.
- Auth bootstrap, callbacks, linking, recovery, and sign-out are serialized so recovery cannot be replaced by a second anonymous session. Guest data requires confirmation before switching accounts.
- RevenueCat identity synchronization is centralized on the stable Supabase UUID, refreshes CustomerInfo and AI access, and leaves a recovered Supabase session intact when subscription refresh is temporarily unavailable.
- Settings now shows guest, secured-email, signed-out, recovery, restore-purchases, and safe sign-out states without exposing production UUIDs.
- Onboarding storage and routing were not changed; account linking and sign-out preserve local onboarding completion.
- No migration, Edge Function, dependency, provider, worker, queue, duration/retry, Gemini, or native-package change was required.
- Validation passed: `npm test`, `npm run typecheck`, `npm run lint`, `npm run qa:static`, `npm run functions:check`, and `git diff --check`.

## [2026-07-30] M24.5R-FIX Account Access Screen and Email-Change OTP

- Account forms moved out of Settings into the focused `/account-access` route with independent `secure` and `recover` state machines.
- Secure mode now uses `updateUser({ email })`, six-digit `verifyOtp({ type: 'email_change' })`, `resend({ type: 'email_change' })` with a 60-second cooldown, then `updateUser({ password })`.
- The original anonymous Supabase user ID is checked before and after email verification and password creation; no signup, account merge, record migration, or data deletion path exists.
- Recover mode uses email/password sign-in, preserves the existing meaningful-guest confirmation, re-reads the session, synchronizes RevenueCat with the Supabase UUID, and refreshes scoped user-owned data.
- Supabase dashboard requirements: anonymous sign-ins, manual linking, and Email provider enabled; the Change Email Address template must contain `{{ .Token }}` and must not rely on `{{ .ConfirmationURL }}` for this flow. The built-in sender remains rate limited.
- No mobile deep link, migration, Edge Function, native configuration, dependency, onboarding, media-job, queue, Gemini, duration/retry, or RevenueCat backend change was added.

## [2026-07-31] M24.5R-MAGIC Passwordless Account Access

- Password and typed-OTP account access was replaced by one passwordless email-link flow at `/account-access` for both `secure` and `recover` modes.
- The existing `recipe-dost` scheme is reused with `recipe-dost://auth/callback`; the current Supabase client uses the implicit flow and establishes the callback session from official access/refresh parameters.
- Secure mode calls `updateUser({ email }, { emailRedirectTo })`, captures the anonymous UUID, and rejects callback completion unless the authoritative linked user retains that UUID.
- Recover mode calls `signInWithOtp` with `shouldCreateUser: false`, retains meaningful-guest confirmation, and does not reveal whether an email exists.
- Terminated and background callback delivery share one idempotent processor, which re-reads the authoritative session, synchronizes RevenueCat to the Supabase UUID, and refetches scoped user-owned and AI-access queries.
- Supabase Dashboard must allow `recipe-dost://auth/callback`; both the Magic Link and Change Email Address templates must use `{{ .ConfirmationURL }}`.
- No migration, Edge Function, custom email service, dependency, onboarding, media, queue, duration/retry, RevenueCat backend, or native configuration change was required.
