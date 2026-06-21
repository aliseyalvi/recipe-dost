# Recipe Dost Decision Log

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
- Next action: build M7 to connect Save Link flow to backend parsing and save `recipe_items`.
