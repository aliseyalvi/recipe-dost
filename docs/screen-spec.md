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

## M8 Mock Generate Card

Scope: mock `generate-card` Edge Function plus a minimal mobile trigger from the saved-link placeholder. Do not build real AI generation, a full recipe result screen, grocery list generation, RevenueCat/paywall, Android share intent, video download/backup, scraping private content, or medical/diet/calorie/allergy/weight-loss features.

### Backend Flow

saved `recipe_items` row -> `generate-card` Edge Function -> mock `recipe_cards` row -> mobile success state.

### Endpoint

- Route: `/functions/v1/generate-card`
- Methods: `POST`, `OPTIONS`
- CORS allowed headers: `authorization`, `x-client-info`, `apikey`, `content-type`
- Requires authenticated Supabase user JWT.
- Do not deploy with `--no-verify-jwt`.
- Do not use a service-role key in mobile.

Request:

```json
{
  "recipe_id": "uuid"
}
```

Success response:

```json
{
  "ok": true,
  "data": {
    "recipe_card_id": "uuid",
    "recipe_id": "uuid",
    "recipe_title": "string",
    "confidence": "low"
  },
  "usage": {
    "free_recipe_cards_remaining": 0,
    "should_show_paywall": true
  }
}
```

### Mock Recipe Card Rules

- Fetch `recipe_items` where `id = recipe_id` and `user_id = authenticated user id`.
- If not found, return `recipe_not_found` with "Recipe link not found."
- Do not call OpenAI or any LLM provider.
- Use available `recipe_items` fields to create deterministic mock data.
- If `manual_ingredients` exists, use it as ingredient hints.
- If `pasted_caption` or `user_note` exists and title is missing, use a generic platform-based notes title.
- Insert or update one latest mock `recipe_cards` row for the user and recipe to avoid duplicate tap-spam.
- Store `model_used = "mock"`, `prompt_version = "mock-v1"`, token counts `0`, and estimated cost `0`.
- Enforce the M8 free limit as 3 total `recipe_cards` rows per user.
- Update `usage_counters` best-effort for the current month when a new mock card is created.

### Saved Recipe Placeholder

Route: `/recipe/[id]`

M8 historical CTA: "Generate Mock Recipe Card"

On press:
- Track `ai_recipe_started`.
- Show `LoadingState`.
- Call the then-current mock generator helper.
- On success, show:
  - "Mock recipe card generated"
  - returned recipe title
  - "Full result screen is coming next."
- On error, show `ErrorState` with Retry.

### Analytics

Use the existing placeholder wrapper only.

Events:
- `ai_recipe_started`
- `ai_recipe_completed`
- `ai_recipe_failed`

Allowed properties:
- `platform`
- `model_used: "mock"`
- `confidence`

Do not send source URLs, notes, captions, manual ingredients, recipe content, or sensitive personal data.

### Product Guardrails

- Save links, notes, safe metadata, and mock recipe cards only.
- Do not scrape or download videos.
- Do not fetch Instagram, TikTok, Facebook, or YouTube metadata.
- Do not add paywall, RevenueCat, or Android share intent behavior.
- Real AI generation is deferred to M10.
- Full result UI is next as M9.

## M9 Recipe Result Screen

Scope: display existing `recipe_cards` data created by M8 mock generation. Do not build real OpenAI generation, paywall/RevenueCat, video download/backup, scraping, Android share intent, or medical/diet/calorie/allergy/weight-loss features.

### Route

- Route: `/recipe-card/[id]`
- Receives `recipe_card_id`.
- The saved recipe placeholder navigates to this route after generation succeeds.
- Do not create competing result routes.

### Data

- Fetch `recipe_cards` by `id` through `getRecipeCard(recipeCardId)`.
- Use the authenticated Supabase client and RLS.
- Select recipe title, summary, JSON card sections, source link, confidence, model metadata, and timestamps.
- Normalize JSON fields defensively so nulls, strings, objects, or malformed values do not crash the UI.

### States

- Loading: `LoadingState`
- Error: `ErrorState` with Retry and Back to Home
- Missing ID or empty card: `EmptyState`
- Main result: full recipe card sections

### Main Result Sections

1. Header
   - Recipe title or "Untitled recipe"
   - Platform/source badge when `source_link` can be detected
   - Confidence badge
   - If `model_used = "mock"`, show: "Mock recipe card - real AI generation is coming next."

2. Summary
   - `short_summary` or friendly fallback text.

3. Time and serving
   - Prep time
   - Cook time
   - Servings
   - Difficulty

4. Ingredients
   - Render each normalized ingredient name, quantity, and optional notes.

5. Steps
   - Render each step number, instruction, and optional Urdu/Roman Urdu tip.

6. Grocery list
   - Render normalized grocery items.
   - "Copy Grocery List" uses Expo Clipboard, which is already installed.

7. Substitutions
   - Render substitutions only when present.

8. Storage and safety
   - Render storage tip and generic food safety note when present.
   - Do not add medical, diet, calorie, allergy, or weight-loss claims.

9. Missing details
   - Render missing info when present.

10. Source link
   - "Open Original Recipe" uses `Linking.openURL` only for safe http/https links.

11. Footer
   - "Back to Home"
   - "Save another recipe"

### Analytics

Use the existing placeholder wrapper only.

Events:
- `recipe_result_viewed`
- `grocery_list_copied`
- `original_source_opened`

Allowed properties:
- `confidence`
- `model_used`
- `has_grocery_list`
- `has_missing_info`

Do not send source URLs, ingredients, instructions, notes, captions, or recipe content.

### Product Guardrails

- M9 displays saved recipe card data only.
- Real AI generation remains deferred to M10.
- No paywall, video download, backup, scraping, or share intent was added.

## M10 Real Generate Card

Scope: replace the M8 mock `generate-card` behavior with real OpenAI Responses API generation inside the Supabase Edge Function. Preserve the existing saved-link trigger and M9 result screen. Do not build paywall/RevenueCat, Android share intent, library/search, grocery list generation, video download/backup, scraping, or medical/diet/calorie/allergy/weight-loss features.

### Backend Flow

saved `recipe_items` row -> authenticated `generate-card` Edge Function -> OpenAI structured JSON response -> insert/update `recipe_cards` row -> mobile navigates to `/recipe-card/[id]`.

### Generate CTA

Route: `/recipe/[id]`

- CTA label: "Generate Recipe Card"
- Loading state: "Creating your recipe card..."
- On success: navigate to `/recipe-card/[recipe_card_id]`.
- Known friendly errors:
  - `missing_openai_key`: "AI generation is not configured yet."
  - `free_limit_reached`: "You have used your free recipe cards."
  - `invalid_ai_output`: "Recipe card could not be generated. Please add more details and try again."
  - generic: "Something went wrong while creating your recipe card."

### AI Input Rules

- Use only saved `recipe_items` values: platform, title, description, user note, pasted caption, manual ingredients, meal type, cuisine, source link, and metadata status.
- Do not fetch the source link, scrape platforms, download videos, or imply Recipe Dost watched the video.
- Store generated cards with `model_used = AI_MODEL` and `prompt_version = "recipe-card-v1"`.
- Preserve the 3 free recipe card limit.

### Analytics

Events remain:
- `ai_recipe_started`
- `ai_recipe_completed`
- `ai_recipe_failed`

Allowed properties:
- `platform`
- `model_used`
- `confidence`
- `error_code`

Do not send source URLs, captions, notes, manual ingredients, generated recipe content, or sensitive personal data.

## M11 Library + Search

Scope: Library + Search only. Do not build paywall/RevenueCat, Android share intent, grocery list generation, video download/backup, scraping, deleted-video backup claims, or M12+ features.

### Route

- Route: `/library`
- Use the existing `app/library.tsx` route.
- Home "View Library" and the Home Library quick action navigate here.

### Data

Use `getRecipeLibrary()` from `src/lib/api/recipes.ts`.

The helper fetches:
- Current user's `recipe_items`.
- Current user's `recipe_cards` for those recipe IDs.
- Latest recipe card per `recipe_id`, mapped client-side.

Use the authenticated Supabase client and RLS. Do not use service-role keys in mobile.

### Search

Search input placeholder:
"Search recipes, ingredients, or notes"

M11 search is client-side over the fetched user's rows only.

Search fields:
- recipe card title
- recipe item title
- user note
- pasted caption
- manual ingredients
- platform
- cuisine
- meal type

Do not send the raw search query to analytics.

### Filters

Status chips:
- All
- Recipe Cards
- Saved Links

Platform chips:
- All Platforms
- Instagram
- TikTok
- YouTube
- Facebook
- Other

Sort chips:
- Newest first
- Oldest first

### Item Card

Each card shows:
- Title: recipe card title, item title, or "Untitled recipe link"
- Subtitle: platform, status, and created date
- Status badge: "Recipe Card" or "Saved Link"
- Metadata status badge when available
- Short summary when a recipe card exists
- Optional thumbnail when `thumbnail_url` exists
- "Has notes" when user note, pasted caption, or manual ingredients exist

Tap behavior:
- If a recipe card exists, navigate to `/recipe-card/[id]`.
- If no recipe card exists, navigate to `/recipe/[id]`.

### States

- Loading: `LoadingState`
- Error: `ErrorState` with Retry
- Empty: `EmptyState`
  - Title: "No recipes saved yet"
  - Body: "Save your first recipe Reel, TikTok, Short, or food video link."
  - CTA: "Save Recipe Link"
- No search results:
  - Title: "No matching recipes"
  - Body: "Try a different keyword or clear filters."

Pull to refresh refetches library data.

### Analytics

Events:
- `library_viewed`
- `library_search_used`
- `library_filter_changed`
- `library_item_opened`

Allowed properties:
- `result_count`
- `filter_status`
- `filter_platform`
- `has_query`
- `opened_item_type`

Do not send search text, source URLs, captions, notes, ingredients, instructions, or recipe content.
