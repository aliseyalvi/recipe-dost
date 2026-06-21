# Recipe Dost Screen Spec

## M3 Onboarding

Scope: onboarding only. Do not build Save Link, AI generation, library data, grocery list generation, paywall, RevenueCat, or share intent in M3.

### Routing

- `/` checks the authenticated anonymous user's `user_profiles` row.
- If `onboarding_completed` is true, route to `/home`.
- If `onboarding_completed` is false or no profile exists, route to `/welcome`.
- M2 auth bootstrap must finish before the route check runs.

### Welcome

- Headline: "Save recipe videos as clean recipe cards"
- Subtext: "Turn Reels, TikToks, Shorts, and food videos into ingredients, steps, grocery lists, and Urdu/Roman Urdu cooking notes."
- Trust note: "We save recipe cards and links, not video files."
- CTA: "Start Free"
- Analytics: track `onboarding_started` when CTA is pressed.

### Onboarding Steps

Show progress after Welcome as "Step N of 5". Continue is disabled until each required selection is made. Back is available from Step 2 onward.

| Step | Question | Options | Saved Field | Analytics |
| ---: | -------- | ------- | ----------- | --------- |
| 1 | What do you cook most? | Pakistani, Indian, Arabic, Western, Chinese, Baking, Mixed | cuisine_preference | onboarding_step_viewed, onboarding_option_selected |
| 2 | How should Recipe Dost explain recipes? | English, Urdu, Roman Urdu, Both | language | onboarding_step_viewed, onboarding_option_selected, language_selected |
| 3 | How many people do you usually cook for? | 1, 2, 3-4, 5+ | household_size | onboarding_step_viewed, onboarding_option_selected |
| 4 | What is your cooking level? | Beginner, Average, Confident | cooking_level | onboarding_step_viewed, onboarding_option_selected |
| 5 | What do you want to use Recipe Dost for? | Save recipes, Meal planning, Grocery list, Food content ideas | main_use | onboarding_step_viewed, onboarding_option_selected |

Step 2 helper: "You can change this later in Settings."

Step 3 helper: "We will estimate servings and grocery quantities better."

Step 4 helper: "Beginner mode gives simpler steps and extra tips."

Step 5 also includes optional preference chips: Budget meals, Quick meals, Healthy-ish, Kids meals, Ramadan/Iftar, Desserts. These save to `cooking_preferences`.

### Saving

- Save all selections to the persisted Zustand onboarding store as the user selects options.
- On "Finish Setup", upsert `user_profiles` for the current Supabase authenticated user.
- Set `onboarding_completed = true` only after a successful Supabase save.
- Show `LoadingState` while saving.
- Show `ErrorState` if saving fails, with Retry and Continue Later.
- Continue Later keeps the local profile and attempts to save `onboarding_completed = false` to Supabase. If that best-effort save fails, continue without blocking.

### Analytics Privacy

Send only event names and option identifiers. Do not send freeform notes, source URLs, recipe content, or sensitive personal data.

Events:
- `onboarding_started`
- `onboarding_step_viewed`
- `onboarding_option_selected`
- `language_selected`
- `onboarding_completed`

### Product Guardrails

- Save links, notes, metadata, and recipe cards only in later milestones.
- Do not download videos or back up deleted videos.
- Do not scrape private saved folders.
- Do not add medical diet, calorie, allergy, or weight-loss claims.

## M4 Home Dashboard

Scope: Home Dashboard only. Do not build Save Link form, Preview & Add Note, AI generation, Edge Functions, RevenueCat, Paywall, Android share intent, grocery list generation, or real telemetry setup.

### Route

- Use existing `/home` route.
- Do not create duplicate home routes.
- Keep existing M2/M3 auth and onboarding guards: `/` decides whether to send users to onboarding or home. `/home` is allowed for users who choose Continue Later during onboarding.

### Layout

1. Header
   - Greeting: "Assalam o Alaikum 👋" for Urdu/Roman Urdu/Both users, otherwise "Welcome back".
   - Subtitle: "Ready to organize your saved recipe videos?" or a language-aware Urdu/Roman Urdu variant.

2. Main promise card
   - Heading: "Stop losing recipe Reels"
   - Body: "Save TikToks, Reels, Shorts, and food videos as clean recipe cards with ingredients, steps, and grocery lists."
   - Primary CTA: "Save Recipe Link"
   - Secondary CTA: "View Library"

3. Compliance/trust note
   - Text: "Recipe Dost saves recipe cards and links, not video files."
   - Subtle but visible below the promise card.

4. How Recipe Dost works
   - Step 1: "Paste a recipe video link"
   - Step 2: "Add notes or caption if needed"
   - Step 3: "Get ingredients, steps, and grocery list"

5. Recent recipes
   - Query `recipe_items` with:
     `id, source_url, platform, title, thumbnail_url, metadata_status, created_at`
   - Order by `created_at desc`.
   - Limit to 3.
   - Rely on RLS for user-owned rows.
   - Display title or "Untitled recipe link", platform, created date, metadata status badge, and thumbnail when available.
   - Loading: show `LoadingState`.
   - Error: show `ErrorState` with retry.
   - Empty: show `EmptyState` with:
     - Title: "No recipes saved yet"
     - Body: "Save your first food Reel or Short and turn it into a clean recipe card."
     - CTA: "Save Your First Recipe"

6. Quick actions
   - Library -> `/library`
   - Grocery List -> `/grocery`
   - Settings -> `/settings`
   - Use large full-width tap targets.

### Save Link Placeholder

`/save-recipe` remains a placeholder in M4:
- "Save Link flow is coming next."
- "This will be built in M5."

No save form, metadata fetch, Edge Function, or AI behavior is implemented in M4.

### Analytics

Use existing analytics wrapper/stub only.

Events:
- `home_viewed`
- `home_primary_cta_clicked`
- `recent_recipe_clicked`

Do not send source URLs, user notes, captions, recipe content, or sensitive personal data.

### Product Guardrails

- Save links, notes, metadata, and AI recipe cards only.
- Do not download videos or back up deleted videos.
- Do not scrape private saved folders.
- Do not add calorie, allergy, medical diet, or weight-loss claims.

## M5 Save Link + Preview

Scope: front-end Save Link + Preview flow only. Do not build Supabase DB insert for `recipe_items`, `parse-url` Edge Function, AI generation, recipe result screen, library/search, grocery list, RevenueCat/paywall, Android share intent, video download, video backup, or scraping private content.

### Flow

Home -> Save Link -> Preview & Add Note -> safe next-step placeholder.

### Routes

- Save Link uses existing `/save-recipe`.
- Preview route: `/recipe/preview`.
- Safe placeholder route: `/recipe/ready`.
- Do not create duplicate save routes.

### Save Link Screen

- Header: "Save a recipe video"
- Subtext: "Paste a Reel, TikTok, Short, or food video link. We will turn it into a clean recipe card later."
- Input label: "Recipe video link"
- Placeholder: "https://www.instagram.com/reel/..."
- Helper: "Works with Instagram, TikTok, YouTube, Facebook, and other recipe links."
- Compliance note: "Recipe Dost saves recipe cards and links, not video files."
- Primary CTA: "Continue"
- Continue is disabled until URL is valid.
- Show friendly validation errors after blur or invalid submit.

Validation:
- Use zod.
- Trim whitespace.
- Required.
- Must be a valid URL.
- Must use `http://` or `https://`.
- Reject non-URL text.
- Do not fetch remote metadata in M5.

Platform detection:
- `instagram.com` -> `instagram`
- `tiktok.com` -> `tiktok`
- `youtube.com` or `youtu.be` -> `youtube`
- `facebook.com` or `fb.watch` -> `facebook`
- Otherwise -> `other`

### Preview & Add Note Screen

- Header: "Add recipe details"
- Show platform badge: Instagram, TikTok, YouTube, Facebook, or Other.
- Show source URL in readable shortened form.
- Note: "If we cannot read the caption, your notes help AI create a better recipe card."
- Optional text area: "Your note"
- Optional text area: "Paste caption"
- Optional text area: "Manual ingredients"
- Optional meal type selector: Breakfast, Lunch, Dinner, Snack, Dessert, Iftar, Other.
- Optional cuisine selector: Pakistani, Indian, Arabic, Western, Chinese, Baking, Mixed, Other.
- Primary CTA: "Save Link"
- Secondary action: "Back"

### Local Draft

Store draft locally with Zustand and SecureStore-backed persistence:

```ts
type RecipeLinkDraft = {
  source_url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'other';
  user_note?: string;
  pasted_caption?: string;
  manual_ingredients?: string;
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'iftar' | 'other';
  cuisine?: string;
  created_at: string;
};
```

Do not insert the draft into Supabase in M5. Do not call Edge Functions.

### Safe Placeholder

After Preview "Save Link", route to `/recipe/ready`:
- Title: "Recipe card generation is coming next"
- Body: "Your link and notes are ready. The next milestone will connect backend saving and AI recipe cards."

### Analytics

Use existing analytics wrapper/stub only.

Events:
- `link_pasted`
- `link_validation_failed`
- `recipe_save_preview_viewed`
- `recipe_link_draft_saved`

Do not send full source URLs, captions, notes, manual ingredients, or other freeform content. Only send platform and boolean flags such as `has_note`, `has_caption`, and `has_manual_ingredients`.

### Product Guardrails

- Save links, notes, legal metadata, and AI recipe cards only.
- Do not download videos or back up deleted videos.
- Do not scrape private saved folders.
- Do not add calorie, allergy, medical diet, or weight-loss claims.

## M6 Parse URL Edge Function

Scope: backend `parse-url` Edge Function only. Do not build mobile integration, Supabase `recipe_items` insert, AI generation, recipe result screen, library/search, grocery list, RevenueCat/paywall, Android share intent, video download, video backup, or scraping private content.

### Endpoint

- Route: `/functions/v1/parse-url`
- Methods: `POST`, `OPTIONS`
- CORS allowed headers: `authorization`, `x-client-info`, `apikey`, `content-type`
- Compatible with Supabase authenticated and anonymous users.
- No service role key, server secret, or admin secret is used.

### Request

```json
{
  "source_url": "string"
}
```

### Validation

- `source_url` is required.
- Trim whitespace.
- Must be a valid `http` or `https` URL.
- Reject empty string, non-URL text, and unsupported protocols such as `file:`, `javascript:`, `data:`, and `ftp:`.
- Return friendly JSON errors; do not expose raw exceptions.

### Platform Detection

- `instagram.com` -> `instagram`
- `tiktok.com` -> `tiktok`
- `youtube.com` or `youtu.be` -> `youtube`
- `facebook.com`, `m.facebook.com`, or `fb.watch` -> `facebook`
- otherwise -> `other`

Host is normalized by lowercasing and removing leading `www.`.

### Success Response

```json
{
  "ok": true,
  "data": {
    "platform": "instagram | tiktok | youtube | facebook | other",
    "title": null,
    "description": null,
    "thumbnail_url": null,
    "metadata_status": "failed",
    "requires_manual_caption": true,
    "source_url": "original trimmed url",
    "normalized_url": "normalized url",
    "host": "normalized host"
  }
}
```

### Metadata Policy

M6 returns safe fallback metadata only:
- Do not scrape Instagram, TikTok, Facebook, or YouTube pages.
- Do not download videos.
- Do not fetch private pages.
- Do not attempt to bypass platform protections.
- Always return `metadata_status: "failed"` and `requires_manual_caption: true`.

DB logging is skipped in M6. Metadata logging can be connected later when the save flow has a `recipe_id`.

## M7 Cloud Parse + Save Link

Scope: connect the existing Save Link flow to the deployed cloud `parse-url` Edge Function and save a `recipe_items` row. Do not build AI generation, `generate-card`, `recipe_cards` insert, grocery list generation, RevenueCat/paywall, Android share intent, video download/backup, scraping private content, or medical/diet/calorie/allergy/weight-loss features.

### Flow

Home -> Save Link -> cloud `parse-url` -> Preview & Add Note -> save `recipe_items` -> saved-link placeholder.

### Save Link Screen

- Keep M5 URL validation.
- On Continue:
  - Track `metadata_fetch_started` with platform only.
  - Call `supabase.functions.invoke("parse-url", { body: { source_url } })` through the recipe API helper.
  - Show `LoadingState` while checking the link.
  - On success, save returned metadata to the persisted draft and route to `/recipe/preview`.
  - On failure, show `ErrorState` with Retry.
- If `parse-url` returns fallback `metadata_status: failed`, continue to Preview.
- Mobile must not scrape or fetch metadata directly.

### Draft Data

Draft stores:
- `source_url`
- `normalized_url`
- `host`
- `platform`
- `title`
- `description`
- `thumbnail_url`
- `metadata_status`
- `requires_manual_caption`
- optional user note, pasted caption, manual ingredients, meal type, and cuisine

### Preview & Add Note

- Show the platform badge from `parse-url`.
- Show metadata status.
- If metadata failed, show: "We could not read recipe details automatically. Paste the caption or add notes to improve the recipe card later."
- Show title if present.
- Show thumbnail only when a safe http/https thumbnail URL is present.
- Keep fields for note, caption, manual ingredients, meal type, and cuisine.
- Primary CTA: "Save Link".

### Saving

- Require the current Supabase authenticated/anonymous user.
- Insert one `recipe_items` row with `user_id`, source URL, platform, title, description, thumbnail URL, user note, pasted caption, manual ingredients, meal type, cuisine, and metadata status.
- Use the mobile Supabase client and RLS; do not use a service-role key.
- Show `LoadingState` while saving.
- Show `ErrorState` with Retry if the insert fails.
- Invalidate the Home recent recipes query after a successful save.
- Clear the local draft after a successful save.

### Saved Recipe Placeholder

Route: `/recipe/[id]`

Shows:
- "Recipe link saved"
- Platform
- Title or "Untitled recipe link"
- Source link
- Note/caption indicator
- "AI recipe card generation is coming next."
- CTA: "Back to Home"

### Analytics

Use the existing placeholder wrapper only.

Events:
- `metadata_fetch_started`
- `metadata_fetch_completed`
- `metadata_fetch_failed`
- `recipe_save_preview_viewed`
- `recipe_link_saved`
- `recipe_link_save_failed`

Allowed properties:
- `platform`
- `metadata_status`
- `requires_manual_caption`
- `has_note`
- `has_caption`
- `has_manual_ingredients`

Do not send full source URLs, captions, notes, ingredients, recipe content, or sensitive personal data.

### Product Guardrails

- Save links, notes, safe metadata, and later AI recipe cards only.
- Do not download or back up videos.
- Do not scrape private saved folders or platform-protected content.
- Do not add calorie, allergy, medical diet, or weight-loss claims.
