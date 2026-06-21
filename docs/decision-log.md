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
- Next action: build M4 Save Link flow with Supabase Edge Function boundaries and no video downloading.
