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

### POST /functions/v1/save-recipe
Purpose:
Save recipe link, platform, metadata, and user note.

Input:
{
  "source_url": "string",
  "platform": "string",
  "title": "string | null",
  "description": "string | null",
  "thumbnail_url": "string | null",
  "user_note": "string | null",
  "pasted_caption": "string | null",
  "manual_ingredients": "string | null",
  "meal_type": "string | null",
  "cuisine": "string | null"
}

Output:
{
  "ok": true,
  "recipe_id": "uuid"
}

### POST /functions/v1/generate-card
Purpose:
Generate AI recipe card from saved link metadata, caption, note, and user preferences.

Input:
{
  "recipe_id": "uuid",
  "language": "english | urdu | roman_urdu | both",
  "household_size": "1 | 2 | 3-4 | 5+",
  "cooking_level": "beginner | average | confident",
  "cuisine_preference": "string | null"
}

Output:
{
  "ok": true,
  "data": "AI recipe card JSON",
  "usage": {
    "free_recipe_cards_remaining": 0,
    "should_show_paywall": true
  }
}

Rules:
- Verify user JWT.
- Check usage limits.
- Free users get 3 AI recipe cards.
- Save result to recipe_cards.
- Track token usage and estimated cost.
- Return structured JSON only.

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
