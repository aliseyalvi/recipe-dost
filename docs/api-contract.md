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
M8 mock backend flow that generates a deterministic mock recipe card for a saved `recipe_items` row and stores it in `recipe_cards`.

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
    "confidence": "low"
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
    "code": "missing_auth | unauthorized | missing_recipe_id | invalid_recipe_id | recipe_not_found | free_limit_reached | generation_failed",
    "message": "friendly user-safe error"
  }
}

Rules:
- Requires a valid authenticated Supabase user JWT. Do not deploy with `--no-verify-jwt`.
- The Edge Function reads the authenticated user from the Authorization header.
- Fetch `recipe_items` where `id = recipe_id` and `user_id = authenticated user id`.
- If the recipe is missing, return `recipe_not_found`.
- M8 does not call OpenAI or any LLM provider.
- M8 creates mock card JSON matching `docs/ai-prompt-contract.md`.
- Insert a `recipe_cards` row with `model_used = "mock"`, `prompt_version = "mock-v1"`, token counts `0`, and estimated cost `0`.
- If an existing mock card exists for the same user and recipe, update it instead of creating duplicate tap-spam rows.
- Free users can generate up to 3 recipe cards total in M8, enforced by counting the user's `recipe_cards` rows.
- `usage_counters` is updated best-effort for the current month when a new mock card is created, but the M8 limit is based on `recipe_cards` count so usage-counter schema details do not block the milestone.
- Do not use a service-role key in mobile.
- Do not download videos, scrape platforms, or fetch private content.
- Real AI generation is deferred to a later milestone.

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
