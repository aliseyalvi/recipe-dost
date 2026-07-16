# M22E App State Stabilization

Date: 2026-07-10

## Scope

Audit-only pass for onboarding launch routing and stale Home/Library metadata state after Play-installed production QA. No runtime behavior, quota/access logic, RevenueCat entitlement, backend/worker behavior, package IDs, or real env files were changed.

Current branch workflow is correct for this milestone: M22E fixes are prepared on `develop`, then merged to `main` only after QA for a production AAB update.

## M22E.2E Unified observability, privacy, and identity QA freeze

Status: code audit and automated QA complete on `develop`; device/dashboard and
release-only checks remain below.

- App Sentry and PostHog remain fail-closed in ordinary development and preview;
  every EAS profile now explicitly pins both controlled flags false. One Sentry
  initializer/provider and one shared PostHog client/provider remain.
- App Sentry now owns unexpected render, bootstrap, terminal technical metadata/AI,
  Grocery query, RevenueCat offerings/purchase/restore, and Premium access-refresh
  failures. UUID-only Sentry identity is set with the Supabase session and cleared
  with PostHog reset on session loss/sign-out/user switch. Expected validation,
  quota, paywall, cancellation, onboarding, empty, loading, and product retry
  states remain excluded.
- The app sanitizer reconstructs a narrow event and the PostHog sanitizer retains
  its closed event/property taxonomy. Tests cover URLs, auth/tokens, Supabase,
  RevenueCat, AI/recipe content, request/response bodies, Error/stack data,
  purchase identifiers, and person fields.
- Share-intent saving previously emitted both generic and shared legacy events,
  which normalized to duplicate approved save funnel events. The redundant shared
  emissions were removed; the generic start/success/failure transitions remain.
- Welcome retains one guarded `onboarding_started` and one persisted
  `onboarding_completed`; Skip uses the same approved completion transition. App
  bootstrap/Home loading components contain no analytics or exception calls, and
  normalized screen tracking suppresses same-screen rerenders.
- Worker production reporting now additionally requires Render plus `main`;
  controlled testing requires Render plus development + `develop` + the exact
  flag. Active queue flow, expected-failure exclusions, retry semantics, job
  state/backoff, and legacy modules were not changed.
- EAS runtime/source-map variable names and the conditional production Sentry Expo
  plugin are documented. `SENTRY_AUTH_TOKEN` remains build-only. No deployment,
  controlled event, schema, Edge Function, quota, product, entitlement, app
  version, or Android `versionCode` change was made.

Manual evidence still required: run the documented local/device identity,
onboarding, loading, funnel, cancellation/quota, and worker smoke checklist; inspect
the previously generated dashboard events; then verify production source-map
symbolication and real production PostHog delivery on the versionCode 2 release
candidate.

## M22E.2D Welcome/onboarding and loading UX refresh

Status: implemented on `develop`; automated validation and Android device QA status recorded at completion.

- The five design references are stored in `docs/design/stitch-welcome/` and were used only for dark culinary tone, blush/coral emphasis, hierarchy, spacing, page indicators, and CTA rhythm. The app renders responsive React Native cards and icons rather than reference screenshots or remote sample imagery.
- `/welcome` now owns the five-screen value tour. Every page keeps the same safe-area header/body/footer composition, concise product-specific copy, an accessible top-right Skip action, synchronized indicators, a rounded CTA, and responsive scrollable content. Android Back moves to the prior tour page when one exists. Existing Reanimated supplies short page fades; no pager or animation package was added.
- The previous cooking-style, language, household-size, cooking-level, main-use, and optional-preference questionnaire is no longer linked or rendered. Both Skip and final Get Started call the existing `saveOnboardingProfile()` path with `onboarding_completed = true`, invalidate the profile query, and replace into Home only after persistence succeeds. The legacy `/onboarding` route redirects to `/welcome`; completed returning anonymous users still bypass the tour through the same remote profile flag.
- `AppLoadingScreen` is the shared full-screen branded auth/profile bootstrap state. `LoadingState` now uses the same recipe mark for compact in-flow waits, while Home uses `HomeLoadingState` editorial placeholders on its first recipe-library load. Existing loading duration, query, retry, error, background refresh, Sentry, and navigation semantics are unchanged.
- Analytics stays behind the existing abstraction. `onboarding_started` fires once after the welcome guard resolves; `onboarding_completed` fires once only after Skip or Get Started successfully persists completion. No screen-content, raw route, user-entered, URL, or duplicate rerender event was added.
- Deferred polish: final Android device screenshots, large-font/small-screen visual verification, and physical Back/gesture testing remain manual acceptance work. No backend, schema, Edge Function, worker, quota/access, RevenueCat, product, entitlement, app-version, or Android-versionCode change was made.

## M22E.2B Privacy-safe PostHog product analytics

Status: implemented on `develop`; controlled device/PostHog verification pending.

- Audit found `posthog-react-native@4.50.0`, placeholder provider/config files,
  a stale wizard report, and no live SDK client/config plugin. Session Replay,
  Error Tracking, feature flags, CLI upload configuration, and native PostHog
  plugins were absent. Installed Expo peers satisfy product analytics; remaining
  declared peers are optional and intentionally unnecessary for this scope.
- One centralized client now initializes only for a valid project token/HTTPS
  host in production, or the exact development/development controlled-test
  combination. Preview is always disabled. No real env file was edited.
- Manual safe screens, typed focused product events, runtime schema enforcement,
  `before_send`, UUID-only identify, identity reset, and a one-shot Settings test
  are implemented. Session Replay, all autocapture, error tracking, logs, flags,
  surveys, remote config, GeoIP, and debug output remain explicitly disabled.
- Production EAS still needs externally configured
  `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`. The dev-test flag
  is not synced. The old `EXPO_PUBLIC_POSTHOG_KEY` name is rejected and no
  `POSTHOG_CLI_*` variable is needed. The stale wizard dashboard links are not
  treated as proof that the current token/host is valid.
- No backend, Supabase schema, Edge Function, worker, RevenueCat entitlement,
  quota/access, package ID, app version, or `versionCode` changed.
- `npm run qa:static`, final typecheck, nine analytics tests, Expo config,
  static guards, and env template validation passed. The real development
  doctor/validator and production validator fail closed until the current host
  label is replaced externally with the matching HTTPS PostHog ingest origin.
  No device/Live Events QA was possible in this workspace.

## M22E.1R-ICONPOLISH1 Cross-screen iconography and recipe metadata polish

Status: implemented on `develop`; automated validation complete and Android visual QA pending.

Icon system and shared presentation:

- Added the Expo-compatible `@expo/vector-icons` dependency after the audit confirmed that the app had no declared vector-icon package and relied on separate Unicode/text glyph maps. Ionicons is now the canonical family because it provides matching outline/filled navigation and favorite states plus supported Instagram, YouTube, TikTok, and Facebook brand glyphs.
- Added a typed semantic `AppIcon` map and typed platform resolver. Platform values are normalized case-insensitively, including YouTube variants; Instagram, YouTube, TikTok, and Facebook map to supported brand glyphs and any unknown provider maps to a generic link icon. Backend strings are never passed directly as icon names.
- Added shared recipe chrome for one 44px favorite control, one coral glass AI Recipe badge, typed status badges, and reusable platform/creator/duration/date metadata chips. Selected and unselected favorites use Ionicons `heart` and `heart-outline` at the same size and footprint. AI-generated favorites display both the favorite control and AI badge.

Screen corrections:

- Home and Library cards now share the favorite, AI badge, platform, creator, duration, and metadata-chip treatment. Home favorite taps retain the existing ownership-scoped favorite mutation and refresh relevant cached recipe data. Missing creator/duration values are omitted rather than replaced with invented data.
- The floating tab bar uses matching Ionicons outline/filled pairs for Home, Library, Grocery cart, and Settings, while the central Add action keeps the existing plus behavior. Routes, labels, tab handling, safe areas, and the Add/share sheet are unchanged.
- Grocery now uses the standard `share-social-outline` glyph for its existing native Share handler, `copy-outline` for Copy, and cart/list glyphs for Grocery semantics. Shopping-list check state and native share/copy behavior are unchanged.
- Detail, action-menu, Settings, Paywall, processing, and Add-sheet utility marks in scope were migrated from text glyphs to typed semantic Ionicons. External source uses `open-outline`, menus use `ellipsis-vertical`, restore uses `refresh-outline`, warnings use `warning-outline`, and decorative icons remain hidden from accessibility when their surrounding control already supplies the label.

Audit result and constraints:

- The missing/wrong icons were not unsupported vector names: the affected UI used local text glyphs, initials such as IG/TT/YT, or absent metadata icons. Home and Library also had separate card markup. Central typed resolution and shared recipe chrome remove those failure modes without remote assets or new requests.
- No query, route, favorite API, Grocery persistence, Paywall/RevenueCat, quota/access, Supabase schema, Edge Function, worker, package ID, or environment behavior changed. M22E.1R-GROCERY1, M22E.1R-SETTINGS1, M22E.1R-PAYWALL2, and M22E.1R-ICONPOLISH1 are Done; M22E.2 is Next.

M22E.1R-ICONPOLISH1 manual QA checklist:

- [ ] Toggle favorite on Home and Library and verify the same heart changes outline/filled without resizing, survives reload, and remains a 44px target.
- [ ] Verify favorite-only, AI-only, and favorite-plus-AI cards on a small Android screen without badge/menu overlap.
- [ ] Verify real Instagram, YouTube, and TikTok cards show supported brand glyphs; unknown platforms use the link fallback; absent creator/duration fields render no empty chip.
- [ ] Verify Grocery inactive/active cart tabs, native Share, Copy List, and existing checkbox persistence.
- [ ] Verify all tab icons share size/baseline, Add still opens the sheet, Library search works, Settings/Paywall load, recipe source actions work, and development logs contain no unsupported-icon warning or sensitive value.

## M22E.1R-PAYWALL2 Final RevenueCat Paywall sheet redesign

Status: implemented and automatically validated on `develop`; Android purchase QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Architecture and presentation:

- Kept one reusable `/paywall` stack route and changed its presentation to a transparent modal containing a typed native bottom sheet. The underlying screen remains visible behind a non-interactive dim backdrop; the sheet uses the shared Obsidian/coral tokens, 24px rounded top corners, drag handle, accessible close control, tablet max width, scrollable content, and a safe-area-aware sticky purchase footer.
- `src/features/paywall/paywall-presentation.tsx` contains presentation-only sheet, hero, comparison, usage, plan, loading, unavailable, feedback, Premium-active, and footer helpers. `paywall-model.ts` contains package, trigger, usage-clamping, intro-offer, and purchase-error normalization. `app/paywall.tsx` remains the only purchase/restore controller.
- The supplied `stitch-paywall` `screen.png` and `code.html` depict the Settings composition rather than a Paywall. They were therefore used only for the established Obsidian/glass/coral visual language together with `DESIGN.md`; the explicit PAYWALL2 product brief defines the native sheet structure. No Stitch HTML, Tailwind, sample plan, image, font, or remote asset ships.

Real plans, comparison, and usage:

- The existing RevenueCat provider remains responsible for the configured `default` offering. The Paywall accepts only `recipe_dost_premium_monthly` and `recipe_dost_premium_yearly`, including RevenueCat's documented `product-id:base-plan-id` form; it never relies on array order or substitutes weekly/lifetime/unknown products.
- Monthly and Yearly cards use the store's localized `priceString`. Yearly is selected by default when present and alone receives the non-numeric “Best value” badge. There are no hardcoded prices, calculated discounts, or trial claims. Introductory copy appears only when RevenueCat returns `product.introPrice`, using its real price, cycles, and period.
- The comparison states the real contract only: free saved links and Library search, Free 3 total successful AI cards, Premium 100 successful AI cards/month, and generated-card-scoped bilingual help, ingredients/steps, and Grocery lists. No unlimited, nutrition, meal-planning, scaling, export, or video-storage claim is added.
- Usage continues to query `get-ai-access`. Free uses authoritative free limit/used/remaining/reserved fields and Premium uses authoritative monthly fields. Used/remaining/progress are visually clamped, active reservations are disclosed, loading has a skeleton, and failure has an independent Retry without blocking package purchase.

Purchase, restore, and terminal states:

- One synchronous in-flight guard prevents overlapping select/purchase/restore/manage/retry actions. Purchase uses the existing provider call, then refreshes RevenueCat customer information, existing entitlement synchronization, all `ai-access-state` caches, and the Paywall access query. The route closes only after both local Premium and backend access are recognized; generation is never auto-resumed.
- Cancellation, pending approval, product-unavailable, already-owned, and generic failure outcomes stay in the sheet as friendly themed feedback. Raw RevenueCat errors, `customerInfo`, receipts, tokens, store responses, prices, and user identity are never logged.
- Restore remains visible beside the purchase CTA and in loading/unavailable/Premium layouts. It keeps the existing RevenueCat restore/customer refresh/backend sync path and reports Premium restored, no active Google Play purchase, or a friendly retryable failure.
- Active Premium hides all purchase cards and purchase CTA, shows real monthly usage and a recognized current Monthly/Yearly label when available, and offers only Manage subscription, Restore purchases, and Close. Manage uses only RevenueCat's real management URL. Empty/mismatched offerings show Retry, Restore, and Maybe later with no fallback price.

Entry points and analytics:

- The same route now receives a typed analytics-only trigger from Home, Library, Grocery, Settings Upgrade, recipe usage, free-limit, and generation-access-blocked entry points. Dismissal uses `router.back()` and therefore preserves the exact underlying state; direct-route fallback alone uses Home. No existing post-result upgrade prompt was found, so none was fabricated.
- Existing analytics abstraction records `paywall_viewed`, plan selection, purchase start/completion/cancellation/failure/pending, restore start/completion/failure, Premium active/unavailable views, and `paywall_closed`. Properties are limited to trigger, plan/package/product identifiers, intro-offer boolean, access plan, and non-sensitive state booleans.

M22E.1R-PAYWALL2 manual QA checklist:

- [ ] Open from Home, Library, Settings, Grocery, recipe usage, and exhausted Generate; dismiss with X, backdrop, Maybe later, and Android Back and verify exact return context.
- [ ] On a small Android device, scroll comparison/plans while the real selected-plan price and CTA remain sticky and clear large text safely.
- [ ] Verify real Monthly/Yearly localized prices, Yearly default, one-package fallback, no hardcoded price/discount, and no intro copy without a real store offer.
- [ ] Verify Free 0/3, partial, exhausted/clamped, reserved-job, failed-usage-query/Retry, and Premium monthly usage states.
- [ ] Test Monthly and Yearly sandbox purchases, cancellation, pending, offline/store failure, unavailable product, already-owned plan, and repeated-tap locking.
- [ ] Test restore with and without an active Google Play purchase, active-Premium Manage/Restore/Close, and offering loading/unavailable Retry/Restore/Close.
- [ ] Regression-check Add/share, Home, Library/search/tabs, both detail routes, Grocery, Settings subscription actions, Premium sync, and absence of sensitive logs.

## M22E.1R-SETTINGS1 Professional Settings screen redesign

Status: implemented and automatically validated on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Presentation and state:

- Translated `docs/design/stitch-settings/screen.png`, `code.html`, and `DESIGN.md` into native Expo React Native presentation only. Settings now uses the shared Obsidian/coral theme, editorial serif slot, safe-area scrolling, uppercase section labels, 20px glass panels, circular semantic marks, subtle subscription glow, dividers, muted metadata, and tab-bar clearance. Stitch HTML/Tailwind, its gear action, and its Explore/Saved/Create/Cook/Profile navigation do not ship.
- Added focused Settings presentation helpers for the header, sections, panels, rows, icons, profile card, subscription status, dividers, and inline feedback. No icon dependency is declared in this app, so the redesign centralizes the existing typed code-native glyph treatment instead of adding a stabilization dependency.
- Profile presentation omits email/debug identity and shows only the existing safe profile relationship copy plus the first six characters of the anonymous app-profile identifier followed by an ellipsis.

Subscription and preferences:

- Subscription remains derived from the existing `get-ai-access` query and RevenueCat provider. Free shows Free plan, three included AI cards, free saved-link/metadata/Library/Grocery behavior, Upgrade, Restore, and Refresh. Premium shows Premium active, real monthly remaining/usage copy, a valid entitlement renewal/access date when available, Manage, Restore, and Refresh; it never shows Upgrade.
- Upgrade retains `/paywall`; Manage retains the RevenueCat-provided store management URL; Restore retains RevenueCat restore plus entitlement/access synchronization; Refresh retains store refresh plus backend access synchronization. A shared in-flight lock prevents overlapping action taps, and results/errors render as themed inline feedback rather than native white alerts.
- Existing query keys remain `['ai-access-state', user.id, 'settings']` and `['user-profile', user.id]`. Secondary language still opens `/settings/secondary-language` and displays the persisted supported language only. Quota/access rules, entitlement/product IDs, RevenueCat configuration, backend, worker, Supabase schema, package IDs, and env files are unchanged.
- Appearance honestly shows the app's current Dark theme without an inert theme chooser. Contact support is a non-interactive unavailable state because no support address/action is configured. App version/build comes from Expo config/native application metadata rather than a hardcoded display value.

Privacy, deletion, and development safety:

- Privacy retains `/settings/privacy-data`. Delete retains `/settings/delete-account-data` but replaces its native placeholder alert with a themed two-stage confirmation sheet. Because automation is absent, the final state explicitly says no request was submitted and no data was deleted.
- Developer diagnostics remain at the bottom only when `shouldShowCustomDevTools()` returns true. That guard requires both `__DEV__` and `APP_ENV=development`; `APP_ENV=production` completely hides the section and its identity controls.

M22E.1R-SETTINGS1 manual QA checklist:

- [ ] Verify Free shows the exact free state, Upgrade opens Paywall, Restore/Refresh remain usable, and repeated taps cannot overlap actions.
- [ ] Verify Premium shows real monthly access, safe renewal/access date when present, Manage/Restore/Refresh, and no Upgrade CTA.
- [ ] Verify secondary language route and persisted Urdu selection, Dark-only appearance, privacy route, and request-based deletion confirmation/unavailable result.
- [ ] Verify support has no enabled fake action and app version/build matches the installed configuration.
- [ ] Verify production hides all developer controls and development shows them only under the labeled bottom section.
- [ ] Regression-check Home, Library, Add/share, Grocery, Paywall, purchase/restore, Premium sync, bottom navigation, safe areas, and small Android scrolling.

## M22E.1R-GROCERY1 Grocery overview and shopping-list detail redesign

Status: implemented and automatically validated on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Data, routes, and state:

- Grocery remains the existing `app/(tabs)/grocery.tsx` tab. Overview uses `/grocery`; a selected generated card uses the compatible `/grocery?recipeCardId=[recipe-card-id]` detail state, and recipe-card Grocery actions keep that route contract. Detail back intentionally clears selection to `/grocery`; Open recipe remains an explicit safe action.
- Grocery lists continue to come from owned `recipe_cards` through `getRecipeGroceryLists()` / `getRecipeGroceryList()` with query keys `['recipe-grocery-lists']` and `['recipe-grocery-list', recipeCardId]`. No `grocery_lists` table write, schema change, Edge Function, or worker change was added.
- Overview enrichment reads only existing owned, non-deleted `recipe_items` and latest media-job fields for real thumbnail, platform, creator, duration, and safe source title. Ingredient notes already present in `ingredients_json` are retained when they match grocery entries; no AI content is invented.
- Checked IDs remain route-local memory exactly as before, reset when list selection changes, and are not stored in Supabase or device storage. Cards therefore honestly begin at zero checked. Active/Completed use only loaded checked values; persisted cross-screen completion is deferred rather than simulated.

Overview presentation and behavior:

- Adapted the supplied overview reference's visual structure only—the semantically incorrect AI Recipes title and all Stitch sample recipes/images remain excluded. The real Grocery screen uses the shared Obsidian/coral theme, centered Grocery title, existing AI-access pill to unchanged Paywall, glass search, real-state chips, and full-width shopping-list image cards.
- Search is client-side and memoized over safe recipe/list title, source title, platform label, creator, English/Urdu ingredient names, quantity, real notes, and real categories. Raw source URLs and search text are not analytics properties. Loading, blocking error/retry, pull-to-refresh, background error, initial empty, filtered empty, and missing-thumbnail states are explicit.
- Filters are All, Active, Completed, and Recent. Active means at least one loaded unchecked item, Completed means all loaded valid items checked, and Recent sorts existing lists newest first. No meal, health, or platform filter is fabricated.
- Cards show real thumbnail or stable Grocery placeholder, Shopping List badge, title, item/checked counts, progress, platform, safe creator, duration, date, and a three-dot control. The Library-matched dark Modal exposes only Open shopping list, Open recipe, Copy list, and Share list; no unsupported delete action appears.

Shopping-list detail:

- Replaced the generic scrolling card with a safe-area-aware `SectionList`: centered Recipe Dost app bar, recipe title and Shopping List context, English/Urdu/Both segmented control, progress summary, glass checklist rows, quantity pills, checked strike-through/dimming, and floating Copy/Share actions above the existing tab bar.
- Urdu and Both are disabled when no real Urdu-script ingredient exists. Screen selection remains local and defaults from the existing content-language preference. No translation is generated or persisted.
- Real categories are used when present. The active AI grocery contract has no category field, so uncategorized data appears under one honest Ingredients group. Real preparation notes from matched ingredient data are shown when available.
- Copy and native text Share use the selected language and clean `Recipe title / Shopping List / Category / - quantity ingredient` formatting. Internal IDs and URLs are excluded. Clipboard/share success, dismissal, and friendly failures are tracked with safe counts/booleans only.

Deferred:

- Persisted checkbox progress, reliable AI-generated grocery categories, list deletion, pantry management, meal planning, nutrition, custom units, and a standalone grocery-list schema/API remain separate milestones. No dependency or icon package was added; Grocery uses the established code-native editorial glyph treatment.

M22E.1R-GROCERY1 manual QA checklist:

- [ ] Verify empty, loading, error/retry, background refresh, missing-thumbnail, and populated overview states on a small Android device.
- [ ] Search by recipe, English/Urdu ingredient, safe creator, and platform; clear search and verify no-results recovery.
- [ ] Verify All/Active/Completed/Recent reflect loaded state honestly and never claim persistence after leaving a list.
- [ ] Open cards and all four themed menu actions; close by outside tap, close button, and Android back.
- [ ] Verify detail back returns to Grocery, Open recipe works, and no duplicate bottom tab renders.
- [ ] Verify English/Urdu/Both availability, real-category/Ingredients fallback, item check/uncheck, strike-through, quantity, and real notes.
- [ ] Verify Copy List and Share List text excludes IDs/URLs and uses the selected language/grouping.
- [ ] Regression-check Home, Library/search/tabs, Add/share, recipe detail, Paywall/RevenueCat/Premium sync, and floating tab clearance.

## M22E.1R-DETAIL2 Recipe Detail visual QA and header/menu cleanup

Status: implemented on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

AI-ready header and menu:

- Replaced the AI-ready top-right external/open arrow with one accessible `Recipe options` ellipsis control. The bottom Open Original Video CTA is removed from the AI-ready layout, so the action is no longer duplicated.
- Added `RecipeDetailActionMenu`, a safe-area-aware Obsidian React Native `Modal` matching the Library action sheet: dark 72% backdrop, rounded top surface, coral border, context title/source, outside/close/Android-back dismissal, icon rows, inline mutation errors, and themed destructive confirmation.
- Enabled only existing safe actions: Open Original Video when `source_link` is valid, View Saved Source through `/recipe/[recipe_id]`, persisted Favorite/Unfavorite, and ownership-scoped soft Delete. Generate is absent because the card is already ready; Share remains hidden because no existing detail share flow is implemented. Raw URLs are never menu text or analytics properties.
- No usable icon package resolves in the repo (`@expo/vector-icons`, Lucide, `react-native-vector-icons`, and `react-native-svg` are absent), so DETAIL2 adds no dependency. It continues the typed/code-native visual language with ellipsis, chain/source, saved-source, heart, and delete marks; directional arrows are removed from detail source/open affordances.

AI-ready content cleanup:

- Added a polished real-data chip row below the hero for platform, safe creator/channel handle, source-video duration, and Original source availability. Raw/URL-like creator values are rejected. Empty fields disappear without gaps.
- Difficulty and servings are emitted only when their trimmed values are real. Empty, `unknown`, `not specified`, and `n/a` values are hidden in both the editorial stat grid and legacy compatibility grid, eliminating Difficulty Unknown.
- Renamed Culinary Method to Recipe Steps without changing English/Urdu step data.
- Removed Development details/source-model diagnostics from the rendered AI-ready experience and compatibility layout. User-useful source fields moved to the hero chip row; provider/model/debug data remains in code/data only.

Home and Library navigation:

- Home Recent now shows View Recent Recipes, visible Favorites shows View Favorite Recipes, and AI Generated retains View All AI Recipes. Each pushes the existing `/library` route with validated `tab=recent`, `tab=favorites`, or `tab=ai_recipes`.
- Library reads the optional tab parameter and falls back to Recent for missing/invalid values. Manual tab presses still update local selection normally.
- The bottom Library tab explicitly navigates with `tab=recent`, so normal tab entry always defaults to Recent instead of inheriting a Home deep link. No duplicate Library route or navigation shell was added.

M22E.1R-DETAIL2 manual QA checklist:

- [ ] AI-ready header shows ellipsis only; menu opens/closes by button, outside tap, close, and Android back.
- [ ] Menu Open Original, View Saved Source, Favorite/Unfavorite, Delete cancel/confirm, and inline failure states behave correctly.
- [ ] AI-ready bottom has no Open Original CTA and no Development details card.
- [ ] Hero chips show only real platform, creator, duration, and source availability without raw URLs or arrows.
- [ ] Unknown/missing difficulty and servings produce no chip or layout gap; Recipe Steps preserves bilingual content.
- [ ] Metadata ready/loading, AI processing, failed states, Generate/access/Paywall, Grocery, Favorite/Delete, and back routing regressions pass.
- [ ] Home Recent/Favorites/AI buttons open their matching Library tabs; invalid/bottom-tab entry opens Recent; manual switching remains stable.
- [ ] Center Add/share, Library search, Home card detail routes, Premium sync, and small Android safe areas remain unchanged.

## M22E.1R-DETAIL1 State-driven Recipe Detail redesign

Status: implemented on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Architecture and state resolution:

- Added `getRecipeDetailViewState()` under `src/features/recipe-detail/recipe-detail-view-state.ts`. Its typed states are `metadata_loading`, `metadata_ready`, `ai_processing`, `ai_ready`, and `failed`.
- Resolution priority is: real card/result ID → AI ready; active media job → AI processing; failed/cancelled/needs-caption media job → failed; saving/pending/refreshing metadata → metadata loading; failed metadata → failed; otherwise metadata ready.
- `/recipe/[id]` remains the saved-source controller. It retains the existing saved-item/access/media-job/card queries, two-second bounded metadata polling, 2.5-second active-job polling, focus/foreground refetch, create-job/access/RevenueCat checks, retry behavior, and completed-result replacement navigation.
- `/recipe-card/[id]` remains the direct AI-ready route. It retains localization, source opening, tag search, Favorite/Delete, grocery/copy, substitutions, storage/safety, missing-info, and development-only diagnostics. It now also refetches its card/source media state on focus and app foreground.

Native presentation:

- Added shared presentation primitives in `src/features/recipe-detail/detail-presentation.tsx`: safe-area scaffold/header, usage pill, analyzing state, metadata hero/state, AI hero, stat grid, failed state, editorial sections/buttons/chips, and stable image placeholders.
- The Stitch analyzing `screen.png`/`code.html`, metadata `screen.png`/`code.html`, and AI recipe `screen.png`/`code.html` were read as visual references only. Metadata HTML supplied the fetched 9:16 hero/action layout missing from its blank screenshot. No Stitch HTML, Tailwind, fonts, sample recipes, remote image URLs, or bottom navigation were copied into the app.
- Metadata/AI processing use an Obsidian focal canvas, lightweight native activity/orbit treatment, serif italic headline, uppercase intelligence label, honest status label, indeterminate bar when backend progress is absent, and Go to Library/Wait here actions. Metadata preparation also keeps Open Original.
- Metadata ready uses the real thumbnail in a responsive vertical hero, Recipe Overview overlay, normalized HOME2 title, separate creator/platform/duration chips, existing Favorite mutation, Generate CTA, real availability copy, and existing Open Original behavior.
- AI ready uses the real worker/uploaded thumbnail, AI Recipe hero, real tag chips, only-present prep/cook/servings/difficulty stats, summary, existing bilingual language control, glass ingredients, numbered method, grocery actions, substitutions, storage/safety, missing details, source action, Favorite, and soft Delete.
- Failed metadata and AI states use safe product copy and only existing retry/open-source/Library actions. Provider payloads, raw errors, source/CDN URLs, secrets, and models remain hidden outside existing development-only diagnostics.

Data and deferred scope:

- Nutrition is omitted because the real `RecipeCard` contract has no nutrition/macros fields. No Stitch nutrition values or health claims are used.
- Tags, thumbnail, duration, creator, servings, difficulty, Urdu fields, substitutions, storage, safety, and missing information are individually hidden or safely fall back when absent. No JSON is reparsed in presentation code.
- Favorite/Delete are not deferred: M22E.1R-D already supplies schema-backed ownership-safe mutations. Recipe scaling, AI edit, PDF/export, meal planner, nutrition generation, social login/scraping, and video download/storage remain deferred.
- The detail routes are outside tab navigation and do not render a duplicate Stitch bottom bar. A shipped production runtime update requires Android `versionCode` 2 when promoted from `develop` to `main`; this patch does not bump it.

M22E.1R-DETAIL1 manual QA checklist:

- [ ] Save Instagram/TikTok/YouTube links and verify metadata loading transitions to the real source hero without duplicate jobs.
- [ ] Verify normalized title, separate creator/platform/duration, real thumbnail/fallback, Generate, Favorite, and Open Original.
- [ ] Verify Free/Premium/blocked Generate behavior still follows existing access, sync, Paywall, and RevenueCat paths.
- [ ] Verify every active media-job stage uses AI analyzing presentation, honest progress, Wait here, Library exit, and completed auto-navigation.
- [ ] Verify failed metadata and AI states show safe retry/source/Library actions without provider/raw error text.
- [ ] Verify old/new AI cards with missing tags/thumbnails/stats and English/Urdu/Both ingredients/steps.
- [ ] Verify Grocery, tag search, Favorite/Delete, original source, back/returnTo, Home/Library entry, and Add/share regressions.
- [ ] Verify small Android status/gesture safe areas, vertical source hero, long titles, and long bilingual steps.

## M22E.1R-LIBRARY1B Library card icon and action-menu polish

Status: implemented on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Icon and card-overlay decisions:

- The repo has no usable installed icon dependency: `@expo/vector-icons`, Lucide, `react-native-vector-icons`, and `react-native-svg` are absent from app dependencies/runtime resolution. LIBRARY1B adds no package. A local typed `EditorialIcon` helper uses the app's existing code-native symbol approach for link/source, clock, creator, sparkle, heart, hourglass, retry, more, external-link, book, delete, and close treatments.
- Instagram, TikTok, YouTube, and Facebook use compact boxed `IG`, `TT`, `YT`, and `FB` platform marks with their explicit text label. Generic sources use the non-directional chain/source mark. Creator chips use `@`; duration uses a clock. The previous directional arrow beside source/creator metadata is removed.
- Every card now has a 44px outline/filled Favorite button at top left, a nearby state badge with semantic icon (AI Recipe + sparkle, Saved Link + source, Preparing/active work + hourglass, caption/retry + retry), and the existing 44px three-dot button at top right. Nested actions stop propagation so card-body navigation is unchanged.
- The bottom metadata row is standardized as small translucent platform, creator, and duration chips. It uses only existing platform, normalized creator, AI time, or saved source-video duration data; no sample metadata is introduced.

Themed action-menu behavior:

- Replaced the native `Alert` options popup with a React Native `Modal` rendered as an Obsidian bottom action sheet: 72% backdrop, continuous rounded top corners, subtle coral border, safe-area padding, drag affordance, recipe context, icon rows, inline mutation errors, outside-tap close, close button, and Android `onRequestClose` support.
- Open original video is shown only when `source_url` exists, uses existing `Linking` behavior, never displays or logs the URL, and keeps failures inside the themed sheet.
- Generated rows show View AI Recipe. Saved rows show Generate AI Recipe; active saving/metadata/media work shows View progress. All use the existing Library navigation mapper, so the saved-parent route owns generation/access/retry logic and generated rows keep their AI-card route. No generation logic is duplicated in the menu.
- Favorite/Unfavorite uses the existing ownership-scoped `toggleFavorite()` mutation backed by `recipe_items.is_favorite`. Delete uses the existing ownership-scoped soft-delete helper backed by `deleted_at`; the themed confirmation says removal affects Recipe Dost Library only, not the original video.
- Successful Favorite/Delete actions update the exact Library cache, invalidate Home/Library/detail/card/grocery management queries, and retain existing analytics without raw values. Delete removes the active row locally before background refetch.
- Favorite/Delete are not deferred: M22E.1R-D already delivered the schema, ownership filters, RLS behavior, and helpers. A new M22E.1R-LIBRARY2 schema/API milestone is unnecessary for this patch.

M22E.1R-LIBRARY1B manual QA checklist:

- [ ] Verify every normal/search card shows Favorite, semantic state badge, and three-dot controls without overlap.
- [ ] Verify AI, Saved Link, Preparing, Needs retry, platform, creator, and duration icons/marks on small Android widths.
- [ ] Toggle Favorite from the card and menu; confirm Recent/Favorites/Home/detail persistence and no card-navigation leak.
- [ ] Open/close the themed menu by three-dot, outside tap, close button, and Android back.
- [ ] Verify Open original, Generate AI Recipe, View progress, and View AI Recipe route to the existing correct flows.
- [ ] Confirm Delete shows themed confirmation, cancellation preserves the row, confirmation soft-deletes it, and the original video is unaffected.
- [ ] Regression-check search, tabs, bottom navigation, Home, Add/share, paywall/Premium access, and processing refresh.

## M22E.1R-LIBRARY1 Stitch editorial Library redesign

Status: implemented and automatically validated on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Library presentation and behavior:

- Replaced the compact two-column grid with a native Stitch-inspired Obsidian editorial surface: centered coral serif-slot Library title, existing `get-ai-access` usage pill, divider, glass search treatment, horizontal chips, serif tabs, and full-width 318px image cards with a dark readability gradient. The supplied HTML, Tailwind, sample recipes, remote sample imagery, and font imports remain design references only and do not ship in the app.
- Normal mode uses a focusable glass search pill, useful real-query chips (Dinner, Quick, Healthy, Pasta, Chicken, Instagram, TikTok, and YouTube), and Recent, Favorites, and AI Recipes tabs. Recent is all active library rows sorted newest first. Favorites uses the existing persisted `recipe_items.is_favorite`. AI Recipes requires a real `recipe_cards` row or completed media-job result ID.
- Active search uses a native Android-safe `TextInput`, Cancel action, coral underline, active-query clear chip, and up to three suggestions derived from existing AI tags, meal type, cuisine, or platform values. The Filters label is presentational; no unsupported filter sheet or fake result set was added. Chip taps apply the same real client-side search path.
- Search remains client-side over the already-loaded user-owned Library rows. Coverage includes normalized display title, saved/source title and description, source metadata author/creator/channel/uploader/platform/host fields, notes, pasted caption, manual ingredients, cuisine, meal type, AI title/summary, tags, ingredient fields, step fields, and platform. Quick additionally uses real AI prep + cook minutes when present.
- Search results use the same large image-card treatment as normal browsing and add the Stitch narrative heading and dynamic saved-recipe count. Empty results, empty Favorites, empty AI Recipes, initial empty Library, loading, blocking error/retry, and background-refresh warning states are explicit.

Card and navigation decisions:

- Cards reuse the HOME2 title normalizer so raw URLs, weak creator-only titles, and “Video by” / “Post by” fallbacks do not become primary titles. Existing thumbnails are used in worker, uploaded, then saved-item order; missing/failed images use a native placeholder without external dummy assets.
- Real card content supplies summary, platform/meal type, AI recipe time or source-video duration when available, and creator/source metadata. Saving/pending metadata shows Preparing; active AI work shows its existing stage; failed metadata/media jobs show Needs retry; caption-required jobs remain explicit.
- Navigation is unchanged: a real/latest completed AI card opens `/recipe-card/[id]?returnTo=/library`; saved, preparing, caption-required, and failed parent rows open `/recipe/[id]?returnTo=/library`. Bounded polling, focus refetch, foreground refetch, and pull-to-refresh remain intact.
- Favorites are implemented from existing schema-backed data. LIBRARY1 initially kept Favorite/Delete mutations on detail surfaces; LIBRARY1B now safely reuses those same existing mutations from the card overlay and themed Library menu. No export, print, or fake action was introduced.
- The usage pill reuses the existing access function, shows Free remaining or Premium, records plan category only, and opens the unchanged `/paywall`. Bottom content padding clears the existing floating tab bar and center Add flow.

M22E.1R-LIBRARY1 manual QA checklist:

- [ ] Verify normal Library header, usage pill, search pill, chips, tabs, large cards, and final-card tab-bar clearance on a small Android device.
- [ ] Verify Free/Premium usage labels and unchanged `/paywall`, purchase, and restore behavior.
- [ ] Search by title, ingredient, generated tag, platform, creator/source, note/caption, and AI step; verify the narrative count and zero-results state.
- [ ] Verify Dinner/Quick/Healthy/Pasta/Chicken/platform chip queries and active-query clear/Cancel keyboard behavior.
- [ ] Verify Recent newest-first order, real Favorites only, and completed/generated rows only in AI Recipes.
- [ ] Verify saved, preparing, failed, active AI, and completed AI card states route to the existing correct detail/progress/retry surface.
- [ ] Verify View recipe and Open original menu actions without raw URL analytics or a destructive Library action.
- [ ] Regression-check Home, center Add/share sheet, Grocery, Settings, bottom tabs, AI completion refresh, and paywall/Premium sync.

## M22E.1R-HOME2 Home processing cleanup and title normalization

Status: implemented and automatically validated on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Home presentation decisions:

- Removed the separate Currently Processing section. Its duplicate came from selecting the same newest `recipe_items` row independently as both `processingRecipe` and `recentRecipe`, then rendering both. Processing now appears once inside Recent with the real thumbnail or hourglass fallback, compact preparing/processing badge, creator chip, status metadata, and a subtle progress treatment.
- The Recent item keeps the same parent recipe ID while metadata or AI state changes. Saved/processing rows open `/recipe/[id]?returnTo=/home`; rows with a real recipe card or completed result ID open `/recipe-card/[id]?returnTo=/home`.
- The current Recent item is excluded from the immediate Favorites and AI Generated feature slots. Those sections show another real row when available; AI Generated stays hidden when its only item is already Recent, preventing the same hero card from repeating near the top.
- Existing `['recipe-library', user.id]` polling, save/metadata/AI invalidation, Home focus refetch, and app-foreground refetch remain unchanged. No endpoint or query key was added.
- The AI usage pill remains pressable and routes to the existing `/paywall` flow for every access state.

Display-title precedence:

1. Real `recipe_cards.recipe_title` for an AI card.
2. Meaningful title from normalized media-job or source metadata.
3. A display-only title derived from the first useful description/caption line, with URLs, mentions, hashtags, excess emoji, and common “full recipe below” tails removed and a 58-character card cap.
4. Existing `recipe_items.title` only when it is not a weak creator/platform/URL fallback.
5. Instagram recipe link, TikTok recipe link, YouTube recipe link, or Recipe link.

Titles beginning with “Video by” or “Post by”, raw URLs, platform-only values, and titles equal to the creator/channel are rejected as primary card titles. Database values are not mutated.

Creator/channel behavior:

- Creator chips use existing safe metadata variants: `author_name`, `author_username`, `authorUsername`, `author`, `creator`, `channel_name`, `channel`, `uploader`, `username`, `handle`, and `ownerUsername`. Normalized media-job creator metadata is checked first; Instagram/TikTok handles receive an `@` presentation when appropriate.
- If creator data is absent, the chip shows the safe platform label. URLs and private extraction data are never used or logged.
- The app library query previously omitted the existing `recipe_items.description` and `duration_seconds` columns. HOME2 adds them to the same query so caption fallback can use the stored description without a schema/backend change. Some providers may still return no meaningful title or description; those rows intentionally use the platform fallback and may need a later worker/provider metadata improvement.

M22E.1R-HOME2 manual QA checklist:

- [ ] Empty or inactive Home has no Currently Processing section.
- [ ] New Instagram, TikTok, and YouTube saves each appear once in Recent and open saved-recipe detail while preparing.
- [ ] Metadata completion updates the same Recent card title, thumbnail, badge, and status without a duplicate/glitch.
- [ ] AI completion updates Recent routing to AI detail and does not immediately repeat the same card in AI Generated.
- [ ] “Video by …” / “Post by …” titles fall through to caption or platform copy; creator remains visible as a chip.
- [ ] YouTube uses a meaningful stored/oEmbed title when present.
- [ ] Add/share, focus/foreground refresh, AI usage pill to Paywall, RevenueCat, and production-safe logging remain unchanged.

## M22E.1R-K0 Add/share entry regression recovery

Status: implemented and automatically validated on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Root cause and recovery:

- The K redesign kept both Add entry points connected to the globally mounted `SaveRecipeModalProvider`, but moved the Gorhom `present()` / `dismiss()` state transition from that stable provider into the extracted `ImportRecipeSheet`. This lifecycle ownership change removed the previously proven provider-level open transition and caused both center Add and Android share to reach state without visibly presenting the sheet.
- K0 restores the provider-owned `isOpen` transition and previous-open guard. `ImportRecipeSheet` remains mounted under the global `BottomSheetModalProvider` and is presentation-only, preserving the editorial UI without a route fallback or new dependency.
- Center Add uses the restored sheet from Home, Library, and other tabs. Native Android share intent and the `/share-recipe` compatibility route use the same sheet with `initialUrl` prefilled. `/save-recipe` remains a compatibility redirect to `/home`.
- Android back, backdrop, cross, and swipe continue using the existing safe close path. No raw URL logging was added.

Preserved save behavior:

- URL validation/normalization, clipboard handling, duplicate detection, `save-recipe-link`, metadata refresh, and Home/Library invalidation are unchanged.
- Confirmed saves close the sheet and navigate to `/recipe/[id]?returnTo=/home`, where the existing Preparing preview state is shown. Saving a link does not create a media job.
- Backend/worker, schema, access/quota, RevenueCat entitlement/products, package IDs, env files, and the Home redesign were not changed.

M22E.1R-K0 manual QA checklist:

- [ ] Center Add opens the Import Recipe sheet every time from Home and Library.
- [ ] Android back closes the open sheet safely.
- [ ] Instagram, TikTok, and YouTube native shares open the app, present the sheet, and prefill the URL.
- [ ] Valid, invalid, clear, clipboard paste, duplicate, network, and save states retain friendly behavior.
- [ ] Confirmed save opens `/recipe/[id]`, shows Preparing preview, and refreshes Home/Library.
- [ ] No raw URL is logged; Premium/paywall, Home, tabs, and metadata behavior remain unchanged.

No temporary route fallback is active. Follow-up visual polish is unnecessary unless device QA finds a separate small-screen issue.

## M22E.1R-K Add / Share Recipe Modal Redesign

Status: implemented on `develop`; Android device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Import sheet redesign:

- The existing `SaveRecipeModalProvider` remains the single Add/share orchestration surface. Its Gorhom UI is now extracted into a typed `ImportRecipeSheet` with the M22E editorial Obsidian/coral theme, 60% backdrop, rounded top sheet, drag handle, centered serif “Import Recipe” title, close action, numbered instructions, focused URL field, clear action, clipboard paste, inline feedback, and full-width Save Recipe CTA.
- Center Add still opens the provider with an empty URL. Both the native Android `expo-share-intent` handler and `/share-recipe` compatibility route still open the same sheet with the extracted URL and “Shared from another app” hint. `/save-recipe` route compatibility is unchanged.
- Visible guidance emphasizes Instagram, TikTok, and YouTube. Existing Facebook and backend-safe `other` HTTP(S) links remain accepted by the unchanged validator/platform detector/save Edge Function; this UI patch does not narrow backend support.
- The sheet reuses `validateRecipeUrl`, `normalizeRecipeSourceUrl`, duplicate cache detection, `saveRecipeLink`, `refreshRecipeMetadata`, and existing Home/Library cache invalidation. Paste keeps meaningful URL query parameters; no raw URL is sent to analytics or console output.

Submit and error decisions:

- Save no longer dismisses optimistically or claims success before the Edge Function responds. While saving, the sheet remains visible with a disabled “Saving…” action. A confirmed new item updates/invalidate list caches, starts the existing metadata refresh, closes the sheet, and navigates to `/recipe/[id]?returnTo=/home` so the existing Preparing preview state is visible.
- Saving a link remains free and does not create a `media_job`; AI generation remains a later explicit detail-screen action governed by existing access logic.
- Invalid URL, empty/failed clipboard, duplicate, missing session, and API/network failures render inline friendly copy. Raw Edge Function messages, URLs, secrets, tokens, and session data are never displayed or tracked.
- Keyboard behavior uses the existing bottom-sheet text input, extend/adjust-resize behavior, scrollable content, safe-area padding, swipe/back/close handling, and keyboard dismissal on drag. Closing is blocked during an active save.

Deferred items:

- Photo import.
- Push notifications.
- Further tags/search redesign.
- Further favorite/delete redesign or schema work.

M22E.1R-K manual QA checklist:

- [ ] Center Add opens an empty Import Recipe sheet; backdrop, close, swipe-down, and Android back dismiss cleanly.
- [ ] Valid Instagram/TikTok/YouTube and existing Facebook URLs enable Save; invalid text shows the supported-link message.
- [ ] Clear removes the URL and disables Save; Paste fills a clipboard URL and handles empty clipboard gracefully.
- [ ] Confirmed save closes the sheet, opens saved-recipe detail, shows Preparing preview, and refreshes Home/Library.
- [ ] Duplicate, network/API, and missing-session paths show only friendly inline messages.
- [ ] Android share-to-app and `/share-recipe` prefill the same redesigned sheet.
- [ ] Keyboard and CTA remain usable on a small Android device with gesture navigation.
- [ ] No save action creates a media job; Premium, paywall, products, quota/access, and AI generation remain unchanged.

Release note: this runtime/UI change requires Android `versionCode` 2 when shipped through the guarded production release from `main`. The develop config remains at versionCode 1.

## M22E.1R-G2 Home Editorial Behavior Correction

Status: implemented on `develop`; device QA pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Home section order and navigation decisions:

- Home order is Header, Currently Processing when active, Recent, Favorites only when a persisted favorite exists, then AI Generated. This keeps retrieval and in-progress work above optional organization surfaces.
- The Currently Processing card uses the real parent `recipe_items.id` from `getRecipeLibrary()` and opens `/recipe/[id]?returnTo=/home`, where the existing saving, Preparing preview, and AI-job progress UI lives. Its separate Open Library button still opens `/library`; Library is no longer the card-tap destination.
- Recent shows one full-width editorial card selected from real library items by the newest activity across `recipe_items.created_at/updated_at`, latest `recipe_cards.created_at/updated_at`, and latest `media_jobs.created_at/updated_at`. It includes both saved links and completed AI cards, uses existing thumbnails only, and never creates display-only recipe records.
- A Recent saved link opens `/recipe/[id]?returnTo=/home`. A Recent item with a real `recipe_cards` row opens `/recipe-card/[id]?returnTo=/home`; the existing completed-job result ID is the fallback card target. View Library opens `/library` because Library does not currently expose a route-param AI filter.
- Active metadata/media-job states retain the existing bounded five-second list polling. Home also retains focus and app-foreground refetch, while save metadata completion and AI result discovery continue invalidating `['recipe-library']`. This makes the completed item eligible for Recent without adding unbounded polling or a new data request.
- The usage pill is now a pressable control with the label “View AI recipe usage and Premium options.” It opens the existing `/paywall` access/subscription screen for Free, Premium, loading, and temporarily unavailable states without changing access logic, products, purchase, restore, or the `premium` entitlement.
- Favorites is hidden when there is no real `recipe_items.is_favorite` row. Existing schema-backed favorites from M22E.1R-D remain supported, but this patch adds no favorite/delete schema, mutation, or placeholder content.

M22E.1R-G2 manual QA checklist:

- [ ] Empty Home shows no fake cards and shows the Recent add-recipe empty state.
- [ ] Saving/sharing a URL shows Currently Processing; card tap opens saved-recipe detail and Open Library still opens Library.
- [ ] Background/reopen during metadata work refreshes the stage without unbounded polling.
- [ ] Metadata completion removes stale processing and moves the latest item into Recent.
- [ ] AI completion shows the generated card in Recent and AI Generated.
- [ ] Recent saved links open saved-recipe detail; generated cards open AI recipe detail.
- [ ] Usage pill opens Paywall/access for both Free and Premium states.
- [ ] Favorites is absent with no persisted favorite and appears below Recent with real favorite data.
- [ ] All tabs, safe-area spacing, paywall purchase/restore, Premium sync, and save/generate flows remain unchanged.

Release note: this is a runtime behavior correction and requires Android `versionCode` 2 when shipped through the guarded production release from `main`. The develop config remains at versionCode 1.

## M22E.1R-G Editorial Design System and Home Redesign

Status: implemented on `develop`; small-device Android QA and screenshot review pending.

Automated validation passed: `npm run qa:static`, `node scripts/env/env-doctor.mjs development`, `node scripts/env/validate-env.mjs development`, and `node scripts/env/validate-env.mjs production`.

Design reference summary:

- `docs/design/stitch-home/screen.png`, `DESIGN.md`, and `code.html` are visual references only. The implementation translates the Obsidian palette, culinary coral accents, editorial serif hierarchy, translucent surfaces, 20px recipe cards, section rhythm, and centered Add control into typed React Native components; it does not reuse HTML, Tailwind, or sample recipe content.
- Central theme tokens now cover semantic dark colors, spacing, typography slots, radii, borders, and shadows. Existing token aliases remain available so screens outside this milestone stay readable while later redesigns migrate deliberately.
- Bodoni Moda and Work Sans packages are not installed in this repository. The theme exposes editorial and body font slots using startup-safe Android `serif` and system sans fallbacks. Adding bundled Expo-compatible font assets remains a later visual refinement and is not required for this stable patch.

Home data and behavior:

- Home and Library share `['recipe-library', user.id]` and `getRecipeLibrary()`. Home derives Currently Processing from active metadata/media-job states, Favorites from the existing `recipe_items.is_favorite`, and AI Generated from the newest item with an actual `recipe_cards` row or completed `result_recipe_card_id`.
- The usage pill uses the existing `get-ai-access` Edge Function through `getAiAccessState()` and displays free total or Premium monthly remaining-to-start values. It adds no endpoint and changes no quota/access logic.
- Active-state polling, focus refetch, foreground refetch, detail routing, Library navigation, save modal behavior, and safe analytics remain intact. Processing is hidden when no active work exists, and no static/sample recipes or external dummy images are used.
- The bottom tab bar preserves Home, Library, Grocery, Settings, and the existing center save modal flow while adding the visible Add label, coral FAB, translucent dark surface, safe-area spacing, and interaction analytics.

Home redesign acceptance checklist:

- [ ] Header is centered, subtitle is readable, and the usage pill shows the correct Free/Premium remaining count.
- [ ] Currently Processing appears only for active metadata/media-job work and clears after focus/foreground/poll refresh.
- [ ] Favorites shows only persisted favorite data and is hidden when none exists.
- [ ] AI Generated shows the newest real generated card, handles a missing/broken thumbnail, and opens the correct detail.
- [ ] Loading, blocking error with Retry, background refresh warning, and empty states are readable on a small Android device.
- [ ] Home, Library, Add, Grocery, and Settings navigate correctly; content and controls clear the gesture/tab area.
- [ ] Save/share, AI generation, paywall, Premium sync, and production dev-tool guards still behave as before.
- [ ] Capture Home screenshots for empty library, active processing, populated Favorites/AI, free usage, Premium usage, and small-device bottom safe area.

Known deferred items:

- Tags end-to-end generation/persistence quality.
- Favorite/delete schema changes beyond the already-supported M22E.1R-D fields and UI.
- Library/search redesign.
- Recipe detail redesign.
- Paywall redesign beyond the existing M22E.1R-E work.

Release note: shipping this runtime/UI milestone through Google Play requires Android `versionCode` 2. This develop-branch implementation intentionally leaves `app.config.js` at versionCode 1 until the guarded production update is prepared from `main`.

## M22E.1D App-Side Search and UX Polish

Status: implemented on `develop`; device QA pending.

Scope shipped:

- Improved Library search over already-fetched app data; no backend search, RLS, schema, worker, quota/access, RevenueCat, package ID, or env changes.
- AI-generated tags already stored in `recipe_cards.tags_json` are now exposed in list normalization and displayed as chips on the AI recipe detail screen.
- Library search now covers saved-link title, source URL, source metadata title/description/author/platform/host, platform, notes/caption/manual ingredients, cuisine, meal type, AI recipe title/summary, AI tags, AI ingredients, and AI steps.
- Saved-link detail now gives stronger "Open Original Video" placement and clearer copy that metadata/AI processing can continue while the user leaves the screen.
- Paywall now includes a Free vs Premium benefit comparison without changing products, entitlement, or limits.

Favorite/unfavorite, delete with confirmation, manual tags, and any schema-backed favorites/tags are deferred. The audit found `recipe_cards.tags_json` already exists, but `recipe_items` does not currently have an `is_favorite` column. A future favorites slice should add the smallest safe `recipe_items.is_favorite boolean default false` migration only after dev QA approval, then update Supabase generated types and guarded user-owned mutations. Delete can likely use the existing user-owned `recipe_items` delete policy and cascade relationships, but should ship with explicit confirmation copy and list invalidation in a separate low-risk patch.

M22E.1D manual QA checklist:

- Generate a new AI recipe and verify tags appear on the AI recipe detail screen when the card includes `tags_json`.
- Open an existing AI recipe without tags and confirm the detail screen still opens cleanly.
- Search by saved-link title.
- Search by AI recipe title.
- Search by ingredient.
- Search by step text.
- Search by tag.
- Search by platform/source metadata.
- Save/share a link, start AI generation, leave the detail screen while processing, and confirm Home/Library eventually show the completed card.
- Confirm "Open Original Video" is easy to find on saved-link and AI recipe detail.
- Open paywall and confirm the Free vs Premium comparison preserves Free = 3 successful AI generations, Premium = 100 AI recipes/month, and 2-minute beta video length.
- Confirm paywall purchase/restore visibility and Premium entitlement name remain unchanged.
- Fresh install onboarding check remains pending device QA from M22E.1A.

## M22E.1E Processing and Paywall Polish

Status: implemented on `develop`; device QA pending.

Scope shipped:

- AI generation progress now has explicit "Go back to Home/Library" and "Wait here" actions.
- The leave action keeps the current background-job model and relies on existing Home/Library query refresh to show the completed card.
- The wait action stays on the detail screen and refetches the current recipe/media-job queries.
- Saved-link metadata copy now separates saving, pending preview, and failed preview states.
- Paywall comparison copy now clarifies that free users get 3 total AI recipe cards and unlimited saved links; ingredients, steps, and grocery lists apply to generated AI cards.
- Paywall usage clarity uses the existing `get-ai-access` query already present on the paywall; no new backend call was added.
- Tag QA note: M22E.1D app UI can only display/search tags when `recipe_cards.tags_json` is populated. Empty tags on newly generated cards should be handled in a separate prompt/Edge Function contract patch, not in this app-side processing/paywall polish.

M22E.1E manual QA checklist:

- Start AI generation and wait on the detail screen until completion.
- Start AI generation, tap Go back to Home/Library, and confirm the card updates in the list.
- Start AI generation, tap Wait here, and confirm the progress state remains visible.
- Close/reopen during processing and confirm Home/Library refresh.
- Force or observe a failed AI job and confirm friendly failure plus retry behavior.
- Save a link with pending metadata and confirm the saved-link detail says "Preparing preview...".
- Force or observe metadata failure and confirm retry details remains available.
- Open paywall as a free user and confirm the comparison does not imply unlimited ingredient/step generation.
- Open paywall as Premium and confirm active state, manage/restore controls, products, and entitlement behavior are unchanged.

## Fresh Install Expected State Machine

1. Native app launches and `app/_layout.tsx` renders `AppProviders`.
2. `AuthProvider` runs before route content. It calls `getSession()` from Supabase auth storage.
3. If no persisted session exists, `signInAnonymously()` creates a Supabase anonymous user.
4. `/` runs `useUserProfileQuery()` with key `['user-profile', user.id]`.
5. If there is no `user_profiles` row, or the row has `onboarding_completed = false`, `/` redirects to `/welcome`.
6. `/welcome` repeats the profile query guard. It shows the welcome screen only while `onboarding_completed` is not true.
7. Tapping Start Free routes to `/onboarding` and tracks `onboarding_started`.
8. `/onboarding` writes selections to the persisted Zustand/SecureStore onboarding store as the user answers.
9. Finish Setup calls `saveOnboardingProfile()`, upserts `user_profiles`, sets `onboarding_completed = true`, invalidates `['user-profile', user.id]`, tracks `onboarding_completed`, and routes to `/home`.

Fresh install expectation: a real clean install with no restored SecureStore session and no existing anonymous user profile should show `/welcome` before onboarding.

## Returning User Expected State Machine

1. Native app launches.
2. Supabase auth loads the persisted anonymous session from SecureStore.
3. `/` queries `user_profiles` for that session's `user.id`.
4. If `onboarding_completed = true`, `/` redirects to `/home`.
5. If `onboarding_completed = false` or the row is missing, `/` redirects to `/welcome`.
6. Opening `/welcome` directly also redirects to `/home` when the profile row is complete.

Continue Later nuance: `/onboarding` can route directly to `/home` after best-effort saving `onboarding_completed = false`, but a later normal launch through `/` will route that same user back to `/welcome`.

## Current Onboarding Behavior

Relevant files:

- `app/_layout.tsx`: root Stack is wrapped by `AppProviders`.
- `src/providers/app-providers.tsx`: provider order is Query -> Auth -> RevenueCat -> modal/share handlers.
- `src/providers/auth-provider.tsx`: bootstraps an existing Supabase session or creates anonymous auth.
- `src/lib/supabase/client.ts`: Supabase auth uses SecureStore-backed persistence with `persistSession: true`.
- `src/features/onboarding/use-user-profile-query.ts`: profile query key is `['user-profile', user?.id]`.
- `app/index.tsx`: `/` redirects to `/home` when `profileQuery.data?.onboarding_completed` is true, otherwise `/welcome`.
- `app/welcome.tsx`: welcome screen redirects to `/home` if the same profile row is complete.
- `app/onboarding.tsx`: finish upserts `user_profiles` and invalidates the user-profile query.
- `src/features/onboarding/onboarding-store.ts`: local onboarding selections persist in SecureStore under `recipe-dost-onboarding-profile`.

Likely cause of skipped welcome:

- The route guard is remote-profile-first, not local-onboarding-store-first. A persisted Supabase anonymous session whose `user_profiles.onboarding_completed` is already true will skip `/welcome` by design.
- This matches the QA note if the Play-installed production app reused previous app data, an existing anonymous session, a dev identity, or restored app data from the same package.
- The persisted Zustand onboarding flag is unlikely to be the direct redirect cause because `/` and `/welcome` do not read it for routing. It can preserve selections, but the redirect decision comes from `user_profiles`.

Open verification item: test a true clean install by clearing app data or uninstalling with backup restore disabled where possible, then confirm the first launch has no existing Supabase session and routes to `/welcome`.

## Current Home Stale Metadata Behavior

Relevant files:

- `src/providers/query-provider.tsx`: React Query defaults are `retry: 1` and `staleTime: 30_000`.
- `app/(tabs)/home.tsx`: `['recent-recipes', user.id]` fetches `getRecipeLibrary({ limit: 6 })` and polls only while a visible `latest_media_job` is active.
- `app/(tabs)/library.tsx`: `['recipe-library', user.id]` fetches `getRecipeLibrary()` and polls only while a visible `latest_media_job` is active.
- `src/features/save-recipe/save-recipe-modal.tsx`: save uses optimistic cache writes, replaces them with the saved item, invalidates list queries, then starts `refreshRecipeMetadata()` in the background.
- `app/recipe/[id].tsx`: detail uses `['recipe-item', recipeId]`, polls every 2 seconds while metadata is active, and refetches recipe/media-job queries on navigation focus.
- `src/lib/api/recipes.ts`: `getRecipeLibrary()` reads `recipe_items`, latest `media_jobs`, and latest `recipe_cards`; `getSavedRecipeItem()` reads the single row.

Likely cause of stale Home state:

- Home and Library know how to poll active AI media jobs, but they do not poll rows whose only active state is `recipe_items.metadata_status = 'saving'` or `'pending'`.
- Home and Library also do not refetch on navigation focus, and there is no global React Query/AppState foreground bridge.
- The save modal depends on its own background `refreshRecipeMetadata()` `finally` block to invalidate `['recent-recipes']` and `['recipe-library']`. If the app is backgrounded, killed, or resumed from memory while the server-side metadata write finishes, that client-side invalidation can be missed.
- Detail appears correct because it has its own focus refetch and metadata polling for `['recipe-item', recipeId]`. Opening detail fetches the completed row, while the already-mounted Home list can still be showing its cached pending/saving item.
- A full cold process restart should normally create a fresh QueryClient and fetch current data from Supabase. The reported symptom most strongly matches app resume/background behavior or a warm process with cached query data.

## Query Keys Involved

Onboarding and profile:

- `['user-profile', user.id]`: profile load/upsert routing source of truth.

Home and library:

- `['recent-recipes', user.id]`: Home recent grid.
- `['recipe-library', user.id]`: Library grid.

Saved-link detail and metadata:

- `['recipe-item', recipeId]`: saved-link detail row.
- `['media-job', 'recipe', recipeId]`: latest AI media job for a saved link.

AI recipe card:

- `['recipe-card', recipeCardId]`: generated AI recipe detail.

Related access/usage keys:

- `['ai-access-state', ...]`: AI access and quota state.
- `['usage-summary', ...]`: older usage/list invalidation surface.

Mutation and invalidation summary:

- Save modal save success writes optimistic/list cache data, invalidates `['recent-recipes']`, `['recipe-library']`, and `['usage-summary']`, then starts background metadata refresh.
- Save modal metadata refresh completion invalidates `['recipe-item', recipeItemId]`, `['recent-recipes']`, and `['recipe-library']`.
- Saved-link detail manual metadata retry invalidates `['recipe-item', recipe.id]`, `['recent-recipes']`, and `['recipe-library']`.
- AI job creation writes `['media-job', 'recipe', recipe.id]`, invalidates `['recipe-item', recipe.id]`, and may invalidate `['recipe-card', resultRecipeCardId]`.
- AI result discovery invalidates `['recent-recipes']`, `['recipe-library']`, `['recipe-item', recipeId]`, `['recipe-card', resultRecipeCardId]`, `['media-job', 'recipe', recipeId]`, and `['ai-access-state']`.
- Legacy preview save invalidates only `['recent-recipes', user.id]`; the current visible modal flow is broader.

## Minimal Patch Plan

Keep the implementation small and app-side only:

1. Add a tiny shared helper for active saved-link metadata states, treating `saving` and `pending` as active.
2. Update Home and Library `refetchInterval` predicates to continue polling while a visible row has active metadata or an active media job.
3. Add navigation-focus refetch to Home and Library, matching the existing detail-screen pattern.
4. Add a React Native `AppState` foreground bridge in the query/provider layer or a focused list hook so returning to the app invalidates/refetches `['recent-recipes']` and `['recipe-library']`.
5. Keep cache updates and invalidations scoped to existing query keys. Do not change quota/access logic, RevenueCat entitlement, backend/worker logic, package IDs, or env files.
6. Run `npm run qa:static` and `node scripts/env/env-doctor.mjs development`, then perform the manual QA below on a development/internal build before merging to `main`.

## Manual QA Checklist

- Fresh install: clear app data/uninstall, install build, launch, confirm `/welcome` appears before onboarding.
- Returning completed user: complete onboarding, close/reopen app, confirm it lands on Home.
- Returning incomplete user: tap Continue Later, close/reopen through normal app icon, confirm `/welcome` is shown, while direct Home remains usable after Continue Later.
- Existing production tester: install update over existing app data, confirm users with completed `user_profiles` skip welcome by design.
- Save link foreground: save a URL, keep app open, confirm Home and Library move from Saving/Preparing preview to completed metadata without opening detail.
- Save link background: save a URL, background or close app while metadata is processing, reopen to Home, confirm title/thumbnail/status refresh without opening detail.
- Warm resume under 30 seconds: save a URL, background briefly, reopen within the default stale window, confirm Home refresh still happens.
- Detail consistency: open the saved-link detail after metadata completes, confirm detail and Home/Library agree after returning.
- AI generation: generate a card from a saved link and confirm Home/Library still recognize completed `result_recipe_card_id` as AI Recipe.
- No regression: save/share does not create `media_jobs`; only Generate AI Recipe creates media jobs.
- Production safety: confirm custom dev/test UI remains hidden when `APP_ENV=production`.

## Production AAB VersionCode

Yes, a production AAB update will need Android `versionCode` 2 after the runtime fix is implemented and validated. The current production config documents `android.versionCode: 1`, and Google Play requires every uploaded update for the same package to have a higher version code.

This audit-only documentation patch does not require an AAB by itself. The runtime stabilization patch should bump `versionCode` only when preparing the production update from `main` through the guarded `npm run build:prod` flow.

## Recommended Next Implementation

Implement the minimal app-side refetch patch first. Do not touch Supabase functions, worker code, RevenueCat entitlement/access logic, package IDs, or env files. The fix should be limited to React Query/AppState/focus behavior and, if needed, a small metadata-status helper shared by Home and Library.

## M22E.1B Implementation

Status: implemented; device QA pending.

Changes:

- Added shared recipe-list refresh helpers in `src/lib/api/recipes.ts`.
- `saving` and `pending` metadata statuses now count as active list refresh states.
- Metadata-status polling is bounded by the row's recent `updated_at` age so a permanently stuck row does not cause unbounded polling.
- Home now polls `['recent-recipes', user.id]` while visible recent rows have active metadata or active media jobs.
- Library now polls `['recipe-library', user.id]` while fetched library rows have active metadata or active media jobs.
- Home and Library now refetch on navigation focus.
- Home and Library now refetch when the app returns to foreground through a shared AppState hook.
- Recipe Detail now invalidates Home/Library list keys immediately when `create-media-job` returns a media job with `result_recipe_card_id`; the existing result-ID effect still invalidates recipe-item, recipe-card, media-job, list, and AI access keys.

Runtime boundaries preserved:

- No backend, worker, Supabase schema, quota/access, product limit, RevenueCat entitlement, package ID, or env-file changes.
- No new user-facing feature or production dev/test UI exposure.
- Failed metadata remains a usable saved-link state, with Home/Library showing details unavailable instead of continuing active metadata polling.

Refetched or invalidated query keys:

- `['recent-recipes', user.id]`: Home list query, focus refetch, foreground refetch, active metadata/media-job polling.
- `['recipe-library', user.id]`: Library query, focus refetch, foreground refetch, active metadata/media-job polling.
- `['recent-recipes']`: broad invalidation after metadata retry/refresh and AI result discovery.
- `['recipe-library']`: broad invalidation after metadata retry/refresh and AI result discovery.
- `['recipe-item', recipeId]`: detail row refetch/polling and AI result invalidation.
- `['recipe-card', recipeCardId]`: generated recipe-card invalidation/refetch path.
- `['media-job', 'recipe', recipeId]`: AI media-job invalidation/refetch path.
- `['ai-access-state']`: existing AI result/access invalidation path.

## M22E.1B Manual QA Checklist

- Save link and stay open: save a supported recipe URL, remain on Home, and confirm the card moves from Saving/Preparing preview to completed title/thumbnail/status without opening detail.
- Save link, close app, reopen: save a supported URL, background or close the app while metadata is processing, reopen to Home, and confirm Home refreshes the completed metadata.
- Open detail, go back Home: open a saved-link detail after metadata completes, return to Home, and confirm Home and detail agree on title, thumbnail, and status.
- Generate AI recipe, return Home: generate an AI card, let it complete, return to Home, and confirm the item appears/opens as an AI Recipe.
- Failed metadata state: use a link that fails metadata refresh or force a retry failure, confirm Home/Library show Details unavailable/Saved Link behavior and do not poll forever.
- Fresh install onboarding check: clear app data or install without restored app data, launch, and confirm `/welcome` appears before onboarding for a new anonymous session.

## M22E.1C Competitor UX Audit

Status: decision log only; implementation deferred to M22E.1D.

Summary:

- ReciMe/Pluck-style apps emphasize fast retrieval, visual confidence, clear saved-state controls, and calm background processing.
- Recipe Dost should cherry-pick low-risk organizer and clarity improvements that strengthen the existing link-first AI flow.
- M22E.1D should remain app-side/product-surface focused unless a selected item clearly needs a later schema milestone.
- The current production stability work remains higher priority than large feature expansion.

Selected M22E.1D improvements:

1. Search across recipe title, ingredients, tags, platform, and source metadata.
2. Show AI-generated tags as chips on recipe cards/detail where data already exists.
3. Favorite/unfavorite recipe for quick retrieval.
4. Delete recipe with confirmation and safe ownership checks.
5. Better processing state that clearly tells users they can leave while the AI job continues.
6. Better paywall benefit comparison using the existing `premium` entitlement and current quota model.
7. Optional usage/credits pill in Home and Settings if it can reuse existing access data without new quota logic.
8. Stronger placement for Open original video on saved-link/AI recipe surfaces.
9. New AI Recipe ribbon on newly completed cards.
10. Basic manual tags add/remove, scoped to simple organization only.

Avoided features for now:

- Nutrition calculator/macros: high trust and liability surface; not required for the link-first MVP.
- Meal planner: large workflow expansion beyond save/link/library/paywall stability.
- Recipe scaling: needs ingredient normalization and accuracy guarantees that are not part of M22E.
- Print/export PDF: export polish is lower priority than core Android app QA.
- AI edit: would add new AI mutation paths and prompt/version complexity.
- Photo import: expands input sources beyond public link/caption/manual notes.
- Folders/cookbooks: heavier organization model; defer until simple tags/favorites prove useful.
- Push notifications: requires permission strategy, delivery plumbing, and store-policy review.
- Video downloading/storage: explicitly outside Recipe Dost's compliance stance.

Updated milestone plan:

1. M22E.1C documents the competitor UX decisions only.
2. M22E.1D should implement the smallest safe subset first: processing-state copy, stronger Open original video placement, AI tag chips if already present, and paywall comparison copy.
3. Favorites, delete, and manual tags require schema/API review before implementation; broader search can start client-side over fetched user-owned data.
4. Keep M22E.1D on `develop`, run static QA, then device QA before any production AAB update.

Exact next implementation prompt:

```text
Implement M22E.1D on develop: cherry-pick the lowest-risk competitor UX improvements for Recipe Dost. Documentation from M22E.1C selected search, AI tag chips, favorite/unfavorite, delete with confirmation, clearer leave-while-processing state, better paywall benefit comparison, optional usage/credits pill from existing access data, stronger Open original video placement, New AI Recipe ribbon, and basic manual tags. Start with app-side/UI-only improvements that require no schema/backend changes: processing-state copy, Open original video placement, AI-generated tag chips when existing data is already available, and paywall benefit comparison. Do not add nutrition, meal planner, scaling, PDF export, AI edit, photo import, folders/cookbooks, push notifications, or video downloading/storage. Do not change quota/access logic, RevenueCat entitlement, backend/worker behavior, package IDs, or env files. Update docs/decision-log.md and docs/milestones.md. Run npm run qa:static.
```

## Validation

- M22E.1A: `npm run qa:static` passed.
- M22E.1A: `node scripts/env/env-doctor.mjs development` passed on `develop`, using development env, development Supabase project ref, RevenueCat Test Store key type, and `com.recipedost.dev`.
- M22E.1B: `npm run qa:static` passed.
- M22E.1B: `node scripts/env/env-doctor.mjs development` passed on `develop`.
- M22E.1B: `node scripts/env/validate-env.mjs production` passed with masked production values only.
- M22E.1C: `npm run qa:static` passed.
- M22E.1D: `npm run qa:static` passed.
- M22E.1D: `node scripts/env/env-doctor.mjs development` passed.
- M22E.1D: `node scripts/env/validate-env.mjs development` passed with masked values only.
- M22E.1D: `node scripts/env/validate-env.mjs production` passed with masked values only.

Exact next prompt:

```text
Implement M22E.1B on develop: fix Home/Library stale saved-link metadata after app background/resume. Keep the patch app-side only. Add metadata pending/saving polling for Home and Library, add focus/foreground refetch for recent-recipes and recipe-library, preserve existing query keys and invalidation behavior, do not change quota/access logic, RevenueCat entitlement, backend/worker logic, package IDs, or env files. Update docs/decision-log.md and docs/m22e-app-state-stabilization.md with the implementation result. Run npm run qa:static and node scripts/env/env-doctor.mjs development.
```
