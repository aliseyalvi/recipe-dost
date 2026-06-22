# Recipe Dost API Contract

## Architecture
Mobile app -> Supabase Auth -> Supabase Database / Edge Functions -> AI provider -> Supabase Database -> Mobile app.

The mobile app must never call OpenAI or any LLM provider directly.

## Auth model
Use Supabase Auth.
Start with anonymous/guest users.
Later allow linking guest account to email or social login.

## Edge Functions / Backend endpoints

### POST /functions/v1/parse-url
Purpose:
Validate a pasted recipe link, detect platform locally, and return safe fallback metadata.

Input:
{
  "source_url": "string"
}

Success output:
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

Error output:
{
  "ok": false,
  "error": {
    "code": "method_not_allowed | invalid_json | missing_source_url | invalid_source_url | unsupported_protocol",
    "message": "friendly user-safe error"
  }
}

Rules:
- POST JSON only. OPTIONS preflight is supported.
- `source_url` is required, trimmed, and must be a valid `http` or `https` URL.
- Reject empty strings, non-URL text, and unsupported protocols such as `file:`, `javascript:`, `data:`, and `ftp:`.
- Normalize host by lowercasing and removing leading `www.`.
- Platform detection:
  - `instagram.com` -> `instagram`
  - `tiktok.com` -> `tiktok`
  - `youtube.com` or `youtu.be` -> `youtube`
  - `facebook.com`, `m.facebook.com`, or `fb.watch` -> `facebook`
  - otherwise -> `other`
- Do not download videos.
- Do not scrape Instagram, TikTok, Facebook, YouTube, private pages, or protected content.
- Do not bypass platform protections.
- M6 always returns fallback metadata: `metadata_status: "failed"` and `requires_manual_caption: true`.
- User can paste caption, notes, or ingredients manually.
- Do not use a service role key or custom admin secret in this function.
- DB logging is intentionally skipped in M6 and will be connected in a later save/logging milestone.

## M7 Mobile Save Link Flow

M7 uses the deployed `parse-url` Edge Function and then writes a user-owned `recipe_items` row directly from the mobile app through the Supabase client and RLS.

Flow:
1. Mobile validates the pasted URL locally.
2. Mobile calls `supabase.functions.invoke("parse-url", { body: { source_url } })`.
3. Mobile stores the returned metadata in the local draft.
4. Preview lets the user add optional note, caption, manual ingredients, meal type, and cuisine.
5. Preview inserts into `recipe_items` using the authenticated anonymous user's session.
6. The app routes to a saved-link placeholder. AI recipe card generation is a later milestone.

`recipe_items` insert fields:
{
  "user_id": "current auth user id",
  "source_url": "string",
  "platform": "instagram | tiktok | youtube | facebook | other",
  "title": "string | null",
  "description": "string | null",
  "thumbnail_url": "string | null",
  "user_note": "string | null",
  "pasted_caption": "string | null",
  "manual_ingredients": "string | null",
  "meal_type": "string | null",
  "cuisine": "string | null",
  "metadata_status": "success | partial | failed"
}

Rules:
- Use the public Supabase client and the current authenticated/anonymous session.
- Rely on RLS for user-owned row access.
- Do not use service-role keys in mobile.
- Do not insert `recipe_cards` in M7.
- Do not call AI generation in M7.
- Do not scrape, download, or back up video content.

### POST /functions/v1/save-recipe
Purpose:
Future server-side save endpoint if usage limits, auditing, or server validation need to move behind an Edge Function.

Status:
Not implemented in M7. The M7 mobile app writes simple user-owned `recipe_items` rows directly through Supabase RLS.

### POST /functions/v1/generate-card
Purpose:
M10 backend flow that generates an AI recipe card for an authenticated user's saved `recipe_items` row and stores it in `recipe_cards`.

Input:
{
  "recipe_id": "uuid"
}

Output:
{
  "ok": true,
  "data": {
    "recipe_card_id": "uuid",
    "recipe_id": "uuid",
    "recipe_title": "string",
    "confidence": "high | medium | low"
  },
  "usage": {
    "free_recipe_cards_remaining": 0,
    "should_show_paywall": true
  }
}

Error output:
{
  "ok": false,
  "error": {
    "code": "unauthorized | invalid_request | unsupported_ai_provider | recipe_not_found | free_limit_reached | missing_gemini_key | gemini_rate_limited | gemini_bad_request | gemini_invalid_key_or_forbidden | gemini_model_not_found | gemini_request_failed | missing_openai_key | openai_rate_limited | openai_insufficient_quota | openai_invalid_api_key | openai_model_forbidden | openai_model_not_found | openai_bad_request | openai_request_failed | missing_openrouter_key | openrouter_rate_limited | openrouter_bad_request | openrouter_invalid_key_or_forbidden | openrouter_model_not_found | openrouter_request_failed | missing_kimi_key | kimi_rate_limited | kimi_bad_request | kimi_invalid_key_or_forbidden | kimi_model_not_found | kimi_request_failed | missing_anthropic_key | missing_anthropic_model | anthropic_not_implemented | invalid_ai_output | db_insert_failed | unexpected_generate_card_error",
    "message": "friendly user-safe error"
  },
  "usage": {
    "free_recipe_cards_remaining": 0,
    "should_show_paywall": true
  }
}

Rules:
- Requires a valid authenticated Supabase user JWT. Do not deploy with `--no-verify-jwt`.
- The Edge Function reads the authenticated user from the Authorization header.
- Fetch `recipe_items` where `id = recipe_id` and `user_id = authenticated user id`.
- If the recipe is missing, return `recipe_not_found`.
- The Edge Function reads provider secrets from Supabase function environment variables only. The mobile app never receives AI keys.
- `AI_PROVIDER` supports `mock`, `gemini`, `openai`, `openrouter`, `kimi`, and `anthropic`; it defaults to `gemini` when missing.
- Shared env:
  - `MAX_INPUT_CHARS`
- Gemini env:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`, default `gemini-2.5-flash-lite`
- OpenAI env:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`, default `gpt-4o-mini`
- OpenRouter env:
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_MODEL`
- Kimi env:
  - `KIMI_API_KEY`
  - `KIMI_MODEL`
  - `KIMI_BASE_URL`
- Anthropic env:
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_MODEL`
- Build AI input only from saved `recipe_items` fields: platform, title, description, user_note, pasted_caption, manual_ingredients, meal_type, cuisine, source link, and metadata_status.
- Do not fetch the source URL, scrape platforms, download videos, or claim the video was watched.
- Require structured JSON output matching `docs/ai-prompt-contract.md`; invalid output returns `invalid_ai_output`.
- Insert a `recipe_cards` row with provider-specific `model_used`, provider-specific `prompt_version`, token counts when available, and estimated cost `0`.
- Provider prompt versions:
  - mock: `mock-v1`
  - gemini: `recipe-card-v1-gemini`
  - openai: `recipe-card-v1-openai`
  - openrouter: `recipe-card-v1-openrouter`
  - kimi: `recipe-card-v1-kimi`
  - anthropic: `recipe-card-v1-anthropic`
- If an existing card exists for the same user, recipe, and provider prompt version, update it instead of creating duplicate tap-spam rows.
- Free users can generate up to `FREE_RECIPE_CARD_LIMIT`, default `3`, enforced by counting the user's `recipe_cards` rows.
- When the limit is reached, return `free_limit_reached` with message "You have used your free recipe cards." and usage `{ free_recipe_cards_remaining: 0, should_show_paywall: true }`.
- `usage_counters` is updated best-effort for the current month when a new card is created, but the limit is based on `recipe_cards` count so usage-counter schema details do not block generation.
- Do not use a service-role key in mobile.
- Do not download videos, scrape platforms, or fetch private content.
- Do not add paywall/RevenueCat behavior in M10; paywall remains deferred to M14.
- M14D bilingual output update:
  - New generated cards should include Urdu script fields in `ingredients_json`, `steps_json`, and `grocery_list_json`.
  - `ingredients_json` items may include `name_en`, `name_ur`, `quantity`, `notes_en`, and `notes_ur`, while old `name`/`notes` fields remain readable for backward compatibility.
  - `steps_json` items may include `instruction_en`, `instruction_ur`, `tip_en`, and `tip_ur`, while old `instruction` and `urdu_or_roman_urdu_tip` remain readable for backward compatibility.
  - `grocery_list_json` may be an array of old strings or objects shaped like `{ "name_en": "string", "name_ur": "string", "quantity": "string" }`.
  - Urdu must be Urdu script, not Roman Urdu, for new provider output.

## Android Share Intake

Recipe Dost supports Android text/link share intents for public recipe URLs.

Configuration:
- Android share intent MIME types are limited to text/link sharing such as `text/plain` and `text/*`.
- Video, image, file, private saved folder, and media import intents are intentionally not configured.
- Native share intake may require a development build and may not fully work in Expo Go.

Flow:
1. Android shares text into Recipe Dost.
2. Expo Router native-intent handling redirects to `/share-recipe`.
3. The mobile app extracts the first valid `http` or `https` URL from the shared text.
4. If a URL is found, the app calls the existing `parse-url` flow, stores a local recipe draft, and opens Preview.
5. If no URL is found, the app shows "No recipe link found" with CTA "Paste Manually".

Rules:
- Do not store videos.
- Do not download files.
- Do not scrape source pages.
- Do not claim deleted-video backup.
- Analytics may track `share_intent_received` with platform only or `share_intent_failed` with reason only.

### POST /functions/v1/grocery-list
Purpose:
Generate combined grocery list from selected recipe cards.

Input:
{
  "recipe_ids": ["uuid"]
}

Output:
{
  "ok": true,
  "grocery_list_id": "uuid",
  "items": []
}

### GET /functions/v1/subscription-status
Purpose:
Return user subscription status from subscriptions table.

Output:
{
  "entitlement": "free | pro",
  "status": "active | expired | trial | cancelled | none"
}

### POST /functions/v1/revenuecat-webhook
Purpose:
Receive RevenueCat webhook and update subscriptions table.
This endpoint should use webhook secret verification.

### POST /functions/v1/support
Purpose:
Save user support request.

### DELETE /functions/v1/account
Purpose:
Soft-delete user data where required.

## Mobile direct DB access
Mobile can read/write simple user-owned rows using Supabase client and RLS:
- user_profiles
- recipe_items
- recipe_cards
- collections
- grocery_lists
- support_tickets

Sensitive operations should use Edge Functions:
- AI generation
- usage limit checks
- subscription sync
- account deletion

### M9 Mobile Recipe Card Read

The M9 result screen reads a generated recipe card directly from `recipe_cards` using the Supabase mobile client and RLS.

Helper:
- `getRecipeCard(recipeCardId: string)`

Selected fields:
- `id`
- `recipe_id`
- `user_id`
- `recipe_title`
- `short_summary`
- `ingredients_json`
- `steps_json`
- `time_json`
- `servings`
- `difficulty`
- `grocery_list_json`
- `tags_json`
- `substitutions_json`
- `storage_tip`
- `safety_note`
- `confidence`
- `missing_info_json`
- `source_link`
- `model_used`
- `prompt_version`
- `created_at`
- `updated_at`

Rules:
- Use the authenticated Supabase client and RLS.
- Do not use a service-role key in mobile.
- Normalize JSON fields defensively so nulls, strings, or unexpected objects do not crash the result screen.
- Do not send source URLs, ingredients, recipe instructions, notes, or captions to analytics.

### M11 Mobile Recipe Library Read

The M11 Library screen reads saved recipe links and generated cards through the authenticated Supabase mobile client and RLS.

Helper:
- `getRecipeLibrary(params)`

Behavior:
- Fetch current user's `recipe_items`.
- Fetch current user's `recipe_cards` for those recipe IDs.
- Map the latest card per `recipe_id` client-side.
- Search and filter are client-side over the fetched user's rows for MVP.

Selected `recipe_items` fields:
- `id`
- `source_url`
- `platform`
- `title`
- `thumbnail_url`
- `metadata_status`
- `user_note`
- `pasted_caption`
- `manual_ingredients`
- `meal_type`
- `cuisine`
- `created_at`
- `updated_at`

Selected latest `recipe_cards` fields:
- `id`
- `recipe_id`
- `recipe_title`
- `short_summary`
- `confidence`
- `model_used`
- `created_at`
- `updated_at`

Rules:
- Use the authenticated Supabase client and RLS.
- Do not use a service-role key in mobile.
- Do not fetch other users' data.
- Do not send raw search text, source URLs, captions, notes, ingredients, or recipe content to analytics.

### M12 Mobile Grocery List Read

The M12 Grocery List screen reads one generated recipe card and normalizes its grocery data on device. It does not call AI and does not create a new grocery-list record.

Helper:
- `getRecipeGroceryList(recipeCardId: string)`

Behavior:
- Fetch the authenticated user's `recipe_cards` row for the supplied recipe card ID.
- Prefer `grocery_list_json`.
- If no grocery items can be read, fall back to `ingredients_json`.
- Normalize values into local checklist items:

```ts
type GroceryItem = {
  id: string
  label: string
  quantity?: string
  checked: boolean
}
```

Selected `recipe_cards` fields:
- `id`
- `recipe_id`
- `recipe_title`
- `grocery_list_json`
- `ingredients_json`
- `servings`
- `source_link`
- `created_at`
- `updated_at`

Rules:
- Use the authenticated Supabase client and RLS.
- Filter by the authenticated user's ID in addition to relying on RLS.
- Do not use a service-role key in mobile.
- Do not call AI, generate combined multi-recipe grocery lists, or create grocery delivery integrations.
- Do not send grocery item names, ingredients text, recipe instructions, source URLs, notes, or captions to analytics.

### M13 Mobile Usage Summary

The M13 usage foundation reads free-plan usage directly from user-owned tables through the authenticated Supabase mobile client and RLS. It does not add subscription entitlement logic, RevenueCat, token bundles, or a paywall.

Helper:
- `getUsageSummary()`

Config:
- Mobile reads public Expo env values when present:
  - `EXPO_PUBLIC_FREE_SAVED_LINK_LIMIT`
  - `EXPO_PUBLIC_FREE_RECIPE_CARD_LIMIT`
  - `EXPO_PUBLIC_FREE_GROCERY_LIST_LIMIT`
- Fallback limits:
  - saved recipe links: `20`
  - AI recipe cards: `3`
  - grocery lists: `3`
- Missing, invalid, or values below `1` fall back to the defaults.

Counts:
- `savedLinksUsed`: exact count of current user's `recipe_items`.
- `recipeCardsUsed`: exact count of current user's `recipe_cards`.
- `groceryListsUsed`: count of current user's `recipe_cards` with non-empty `grocery_list_json`.

Return shape:

```ts
type UsageSummary = {
  limits: {
    savedLinks: number
    recipeCards: number
    groceryLists: number
  }
  savedLinksUsed: number
  recipeCardsUsed: number
  groceryListsUsed: number
  savedLinksRemaining: number
  recipeCardsRemaining: number
  groceryListsRemaining: number
  canSaveLink: boolean
  canGenerateRecipeCard: boolean
  canOpenGroceryList: boolean
}
```

Rules:
- Use the authenticated Supabase client and RLS.
- Filter count queries by the authenticated user's ID.
- Do not use a service-role key in mobile.
- The Edge Function remains the source of truth for AI recipe card limits via `FREE_RECIPE_CARD_LIMIT`.
- No subscription entitlement, RevenueCat, token bundle, paywall, video download, scraping, or deleted-video backup behavior is added in M13.
