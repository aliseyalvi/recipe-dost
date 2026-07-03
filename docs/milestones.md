# Recipe Dost Milestones

## M21.9C.4 - Navigation, Live Metadata, and Offline Cache QA Fixes

- Status: Completed after focused validation.
- Fixed QA issues: back navigation avoids duplicate Home stack entries by using real stack back first and `replace` fallbacks only when needed.
- Home now opens detail screens with `/` as the safe parent fallback, while Library and Grocery keep route-specific parent fallbacks.
- AI result auto-open replaces Source Detail with AI Recipe while preserving the original parent `returnTo`, so back returns to the parent screen instead of the old source detail.
- Saved Recipe detail now refetches on focus and polls while metadata is pending/saving/fetching, so title, thumbnail, and duration update without reopening the screen.
- Home/Library loading cards avoid duplicate "Fetching details" text and show a placeholder preview with lightweight activity feedback.
- Home, Library, and Grocery preserve cached list data during background offline/refetch errors and show non-blocking friendly offline messaging when previous data exists.
- Save/share still use saved-link metadata functions only and do not create `media_jobs` or consume AI credits.

## M21.9C - Final Core-Flow QA Freeze

- Status: Completed after focused validation.
- Core-flow QA freeze kept the MVP scope unchanged: manual save/share save still use saved-link metadata functions only, and only Generate AI Recipe can create `media_jobs` or reserve AI access.
- Fixed QA-blocking display consistency by treating completed `media_jobs.result_recipe_card_id` the same as `latest_card` for Home/Library AI filters and grocery affordances.
- Reduced Home/Library card pill clutter so platform stays in subtitle/meta text while the image keeps one primary status pill.
- Fixed nested header back behavior to honor explicit `returnTo` parents before falling back to native history, keeping Source Detail, AI Recipe, Library, and Grocery detail returns predictable.
- Extended friendly offline/network error copy to Library empty errors, grocery list APIs, and usage summary loading.
- Known non-blocking deferred items: native Android share-intent and full device core-flow acceptance still require human QA on a development APK.
- Ready for M21.10A agent QA contract if human acceptance passes.

## M21.9C.3 - Nested Header Back Behavior and Grocery Thumbnails

- Status: Done after validation.
- Nested header back behavior now prefers a safe `returnTo` route param, then `router.back()`, then the screen fallback route.
- Home, Library, Grocery, Source Detail, AI Recipe, and Grocery detail navigations pass parent `returnTo` context into nested screens.
- Auto-opening an AI Recipe from Source Detail keeps a safe return route back to that source detail when the stack has been replaced.
- Grocery cards now reuse the Library thumbnail fallback chain by resolving latest media-job thumbnails before recipe-item thumbnails.
- Main tab roots remain headerless, and the compact nested header style remains unchanged.

## M21.9C.2 - Standard Nested-Screen Header

- Status: Done after validation.
- Replaced the custom large Back pill header with a compact `NestedScreenHeader` using a back arrow, one-line title, and optional right-side icon actions.
- Tab roots still have no back header: Home, Library/Saved Links, Grocery root, and Settings keep the bottom tab shell only.
- Nested/detail screens keep safe fallback back navigation through `router.back()` with route fallback when there is no history.
- Source Detail and AI Recipe detail support compact open-original right actions using existing open-source behavior only.
- Grocery detail uses a simple back arrow plus "Grocery List" title with no right action.

## M21.9C.1 - Navigation Headers and Back Buttons Audit

- Status: Done after validation.
- Main tab roots remain headerless: Home, Library/Saved Links, Grocery root, and Settings keep the existing bottom tab behavior with no back header.
- Nested/detail screens now use visible back navigation: Saved Recipe/Source Detail, AI Recipe detail, and recipe-specific Grocery List.
- Grocery root at `/grocery` stays a tab-root index with no back button; grocery detail at `/grocery?recipeCardId=...` shows a safe in-screen back header.
- Back headers call `router.back()` when history exists and fall back to a parent route (`/grocery` or `/library`) so detail screens do not trap users.
- Header spacing is inside the existing safe-area-aware `Screen` layout, avoiding Android status bar overlap and duplicate native headers.
- Settings has no nested route files in the current Expo Router tree, so Settings remains a headerless tab root.

## M21.9A.2 - Save Recipe Bottom Sheet Modal

- Status: Done after validation.
- Save Recipe URL now uses one global `@gorhom/bottom-sheet` `BottomSheetModal` instead of the custom React Native `Modal` plus Pressable overlay.
- `GestureHandlerRootView` and `BottomSheetModalProvider` are mounted once near the app root.
- Backdrop tap through `BottomSheetBackdrop`, Android hardware back, and the X button are the supported close methods.
- Swipe-to-close and sheet panning are disabled for the MVP to avoid keyboard gesture glitches.
- Shared URLs still open the same provider flow prefilled with "Shared from another app"; invalid shares still show one friendly message only.
- Save still validates the URL, dismisses quickly, shows one optimistic card, and finishes save/metadata refresh in the background.
- New native bottom sheet/gesture dependency behavior requires a fresh development build before device QA.

## M21.9A.1 - Save Recipe Modal Stabilization

- Status: Done after validation.
- Save Recipe now uses a stable full-screen transparent React Native `Modal` with one dark opacity backdrop and one bottom-anchored sheet.
- Backdrop tap, Android hardware back, and the X button close the modal and clear the initial URL/share hint state.
- Swipe-to-close is disabled for this MVP because reliable backdrop/back/X close behavior is safer with the Android keyboard.
- Keyboard-safe layout uses `KeyboardAvoidingView`, a handled-taps `ScrollView`, and preserved Android resize mode so the URL input and Save Recipe button stay reachable.
- Save behavior remains unchanged: validate URL, close quickly, show one optimistic card, then save and refresh metadata in the background.

## M21.9A - AI Queue Reservation and Detail Polish

- Status: Done after validation.
- Active AI jobs now reserve free AI slots while queued, processing, analyzing, pending, running, resolving, downloading, validating, thumbnailing, uploading to AI, or saving results.
- Successful AI jobs count permanently; failed/cancelled/non-result jobs do not permanently consume free credits.
- `get-ai-access` and `create-media-job` share the same server-side slot math and expose safe fields for successful used, active reserved, free limit, remaining to start, and can-start state.
- Source Detail disables duplicate Generate AI Recipe starts, treats duplicate active jobs as analyzing, and auto-opens the AI recipe card when a job started from that screen completes.
- Save modal backdrop/outside close behavior remains the simple modal save flow; sharing/saving still never creates `media_jobs`.
- Source Detail and AI Recipe screens now use visible stack headers, and Android status bar content stays visible on the dark app background.
- Network failures now show friendly offline retry UI on Home, Source Detail, AI access, AI status, and recipe-card loads.

## M21.8C - Share State, Optimistic Save, and Splash Polish

- Status: Done after validation.
- Normal app launch now stays on Home silently: no share error screen and no save modal unless the plus button is tapped or a valid native share URL is received.
- Share handling now uses an explicit idle/valid/invalid/consumed state flow; invalid share text shows one friendly message only after an actual native share payload is received.
- Save modal close behavior was tightened with a visible close button, backdrop close, Android back handling, shared URL cleanup, Android keyboard resize, and scrollable bottom-sheet content.
- Optimistic saves now use one `optimistic:<normalizedUrl>` card, dedupe/replace by normalized `source_url`, and remove the optimistic card on save failure.
- Home background refetch is silent after initial load, avoiding repeated loading/refetch cards and layout jumps.
- AI recipe cards continue to override vague source metadata titles/summaries for Home, Library, and saved-link detail display without mutating `source_url` or source metadata.
- Splash/icon config now references `assets/images/icon.png`, `assets/images/adaptive-icon.png`, `assets/images/splash-icon.png`, and `assets/images/favicon.png`; splash/icon changes require a rebuilt dev APK.

## M21.8B - Android Share Payload + Save UX Polish

- Status: Done after validation.
- Added `expo-share-intent` to read Android shared text payloads in JS; Android share testing still requires a dev build/APK, not Expo Go.
- Shared Instagram, TikTok, YouTube, and Facebook URLs now open the existing Save Recipe modal with the URL prefilled and a "Shared from another app" hint, without creating `media_jobs` or consuming AI credits.
- The save modal is keyboard-safe on Android with resize mode and scrollable bottom-sheet content.
- Saving a valid link now closes the modal immediately, shows an optimistic "Saving" card, replaces it with the saved `recipe_item`, and refreshes metadata in the background.
- Home/Library card states are limited to Saving, Fetching details, Saved Link, Analyzing, AI Recipe, and AI failed, with platform shown in the metadata row.
- When AI generation completes, saved-link detail and list cards prefer the AI recipe title/summary over vague source metadata while preserving the original source URL and metadata.

## M21.8A - EAS Android Development Build Setup

- Status: Done after validation.
- Added `expo-dev-client` aligned with Expo SDK 56 so Android share-to-app can be tested in a development build instead of Expo Go.
- Added a temporary stable Android application ID, `com.recipedost.dev`, for development APK testing until the production package name is finalized.
- Added `eas.json` with internal Android APK profiles: `development` uses `developmentClient: true`, and `preview` builds an internal APK without adding production release settings.
- Android text share intent config remains in `app.config.js` for `ACTION_SEND` with `text/plain` and `text/*`.
- Expo Go cannot fully test native Android share intents; use an EAS development APK or local native build, and rebuild/reinstall the dev app after native config changes.

## M21.8 - Android Share-To-App Modal Save

- Status: Done after validation.
- Android text share intent support remains configured through Expo app config for `ACTION_SEND` with `text/plain`/`text/*`; full native share testing requires a development build/APK, and Expo Go may not receive Android share intents reliably.
- Shared text is parsed for the first supported Instagram, TikTok, YouTube, Facebook, or `fb.watch` HTTP(S) recipe URL, with unsupported text showing "Could not find a recipe video link in the shared text."
- Valid shares open the existing Save Recipe modal with the URL prefilled and a "Shared from another app" hint instead of auto-saving or opening the old preview flow.
- Saving from share uses `save-recipe-link`, then background `refresh-recipe-metadata`, and does not create `media_jobs` or consume AI credits.
- `save-recipe-link` now returns an existing saved item for the same user and normalized URL instead of creating a duplicate row.
- `Generate AI Recipe` remains the only user-facing AI generation path through `create-media-job`.

## M21.7G - Metadata Preview Payload Contract Fix

- Status: Done after validation.
- Direct production worker curl to `/metadata-preview` worked with `{ "url": "...", "platform": "instagram" }`, while the Edge Function reached the worker but received `worker_status = 422` from an invalid payload contract.
- `refresh-recipe-metadata` now validates the saved source URL before calling the worker, logs only safe payload proof fields (`url_present`, `url_length`, `url_host`), and sends the worker body as `{ url, platform }`.
- Worker 422 responses are classified as `worker_validation_error` without retrying or logging raw response text; missing/invalid saved URLs fail locally with `source_url_missing`.
- Saved link metadata failure remains non-blocking: no `media_jobs` are created, cards show `Saved Link` with `Details unavailable`, and Source Detail keeps `Retry details` plus `Generate AI Recipe`.

## M21.7F - Metadata Bridge Warmup and Saved-Link State Polish

- Status: Done after validation.
- Direct production worker curl to `/metadata-preview` works for the known Instagram URL, but the Supabase Edge metadata bridge had previously marked refreshes failed with `worker_status = 503`.
- `refresh-recipe-metadata` now warms the worker with best-effort `GET /ping`, uses a 30-second default metadata timeout, retries once with backoff for timeout/502/503/504, and classifies auth, unavailable, timeout, and config failures with safe error codes.
- Successful worker title, description, thumbnail, duration, platform, and safe metadata now persist back to `recipe_items`; partial useful metadata remains `partial`, and failed metadata remains a usable saved link without creating `media_jobs`.
- Home and Library cards now avoid overlapping/repeated pills and use a clean RD fallback thumbnail with one top status pill.
- Source Detail shows a calm metadata failure message with `Retry details` while keeping `Generate AI Recipe` available through backend access checks.
- The Android share route now saves through `save-recipe-link` and refreshes details through `refresh-recipe-metadata`, avoiding the old visible parse-preview flow.

## M21.7E - Metadata Bridge Fix and Saved-Link UI Cleanup

- Status: Done after validation.
- `refresh-recipe-metadata` now calls worker `/metadata-preview` with `Authorization: Bearer WORKER_API_SECRET`, a 25-second default timeout, and one retry for timeout/502/503/504 only.
- Successful worker title or thumbnail metadata now persists to `recipe_items` with `metadata_status = completed`; partial useful metadata stores `partial`, and failures keep the saved item usable.
- `source_metadata` on saved links is sanitized to safe fields only; full source URLs, thumbnails, CDN URLs, cookies, secrets, temp paths, Gemini URIs, and raw worker responses are excluded.
- Safe metadata refresh logs were added without source URLs, thumbnails, worker secrets, cookies, or raw responses.
- `create-media-job` now prefers `WORKER_API_SECRET` with `MEDIA_WORKER_SECRET` as a temporary fallback.
- `get-ai-access` / shared AI access reads `FREE_AI_GENERATION_LIMIT` from Edge Function env with fallback `3`.
- Home and Library now treat metadata failure as a usable Saved Link with `Details unavailable`; only AI job failures show `AI failed`.

## M21.7 - Worker Metadata + Modal Save UX

- Status: Done after validation.
- Center plus now opens a FoFo-style save modal instead of the old full add screen.
- Saving a link is one step: paste URL, call `save-recipe-link`, show the Home card immediately, then refresh metadata in the background through `refresh-recipe-metadata`.
- Home and Library cards now use user-facing states: Fetching details, Saved Link, Analyzing, AI Recipe, and Failed.
- Source Detail is focused on the saved source, original video link, AI recipes left, and one primary `Generate AI Recipe` CTA.
- `Generate AI Recipe` is the only user-facing action that calls `create-media-job`; saved links and metadata refresh do not consume AI credits.
- AI credit limit errors show the upgrade placeholder copy instead of a generic generation failure.
- Recipe result UI stays focused on recipe content and source actions while keeping technical details dev-only.

## M21.7B - Supabase Saved-Link and Worker Metadata Bridge

- Status: Done after validation.
- Added `save-recipe-link` for authenticated/anonymous users to create saved `recipe_items` only; it does not create `media_jobs`, call AI, or consume credits.
- Added `refresh-recipe-metadata` to call the protected worker `/metadata-preview` endpoint with server-side worker secrets and store only safe metadata on `recipe_items`.
- Metadata preview failures mark the saved item failed without deleting it or blocking the saved-link flow.
- `create-media-job` can now start AI analysis from `recipe_item_id`; it verifies ownership, enforces AI access, then creates the linked `media_jobs` row.
- Edge Functions own auth and DB writes; the worker owns metadata extraction and AI analysis.
- Saved links and metadata preview remain unlimited; AI generation remains credit-gated.

## M21.6 - UX Flow Simplification and Single AI Credit Source of Truth

- Status: Done after validation.
- Saved links, metadata preview, library, and grocery viewing are unlimited for the MVP; visible saved-link and grocery quotas were removed.
- Home, Settings, and saved-link detail now use `get-ai-access` for AI generation credit state instead of local recipe-card remaining values.
- Saved-link detail has one user-facing AI action: `Generate AI Recipe`, which uses the backend-gated `create-media-job` flow.
- The old user-facing manual `generate-card` path is no longer exposed from saved-link detail.
- `ai_credit_limit_reached` now shows a clear "Free AI recipes used" upgrade placeholder with Unlock Pro and Maybe later actions.
- Recipe result UI hides model/source-mode/confidence debug badges from production UI and keeps technical details in a dev-only section.

## M21.5 - Dev Identity Switcher and AI Access QA

- Status: Done after validation and deployment.
- Added a dev-only Settings panel gated by `__DEV__` or `EXPO_PUBLIC_DEV_TOOLS_ENABLED=true`.
- Dev tools show current Supabase anonymous user ID, anonymous status, saved local identity status, and safe AI access state.
- Developers can copy the current user ID, refresh access state, create a fresh anonymous test user, and switch to anonymous users previously saved on the same device.
- Added `get-ai-access` Edge Function using the same server-side access helper as `create-media-job` without creating jobs or exposing source URLs/secrets.
- Mobile dev tools do not allow role changes; admin/tester/premium simulation remains SQL-only.

## M21 - Monetization / Account Foundation

- Status: Done after validation and deployment.
- Added anonymous-first account and entitlement foundation on `user_profiles` for roles, tester flags, AI monthly overrides, and RevenueCat premium entitlement mirror fields.
- Added server-side AI generation access checks before `create-media-job` inserts queued jobs.
- Free users can create jobs while under 3 lifetime successful AI media generations; failed jobs do not count.
- Premium, tester, and admin users use monthly fair-use limits without adding full paywall or signup UI.
- Queue processor behavior remains unchanged after access is granted.

## M19 - App E2E Polish

- Status: Done after validation.
- URL preview now keeps working when metadata fetch fails, and uses safe preview metadata when available: title, thumbnail, creator, platform, and duration.
- Media job and saved-link views prefer live `source_metadata` title/thumbnail while keeping source metadata separate from generated recipe-card titles.
- Completed jobs route only through `media_jobs.result_recipe_card_id`; missing result links show a safe unavailable state while polling can continue.
- Recipe result rendering now handles normalized/stringified JSON more defensively, avoids blank Urdu cards, derives grocery rows from ingredients when needed, and strips old markdown markers from displayed recipe text.
- The app clearly shows the 2-minute video analysis limit and handles over-limit duration errors with friendly copy.

## M17B - Explicit Queue Processor Mode with Render Wake

- Status: Done after validation.
- Added `MEDIA_PROCESSOR_MODE=queue` for Render queue workers: media jobs remain `queued`, `/process-job` is not called, and the worker can be woken with a short GET `/wake` request.
- Queue mode records `queued_for_queue_worker` plus a wake success/failure event without storing the worker URL.
- Manual mode and worker webhook mode remain unchanged.

## A-M15C - Real Source Metadata Display

- Status: Done after validation.
- Media job polling now includes `source_metadata` and the app displays safe source title, description, platform, resolver, duration, size, and thumbnail metadata when available.
- Completed recipe result screens can show the same safe source metadata without querying private processing metadata or displaying CDN URLs.
- Mock recipe result labeling remains subtle and development-oriented.

## A-M15B - Public Source Metadata + Private Processing Metadata Schema

- Status: Done after migration applied.
- Added public app-visible `media_jobs.source_metadata` JSONB storage for safe source metadata.
- Added private backend-only `media_job_private_metadata` storage for resolver/CDN/raw processing metadata.
- CDN URLs remain backend-only and must not be stored in `media_jobs.source_metadata`.

## Current Worker Testing

- A-M14R1 local worker testing requires `MEDIA_PROCESSOR_MODE=manual` for `supabase/functions/create-media-job`.
- Cloud Run worker triggering remains available with `MEDIA_PROCESSOR_MODE=worker`, the default.
- During local and Render worker testing, Cloud Run is bypassed so app-created `media_jobs` can stay queued for manual/local processing instead of being picked up by the old worker.
