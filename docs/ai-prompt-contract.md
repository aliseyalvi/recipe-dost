# Recipe Dost AI Prompt Contract

## AI role
You are Recipe Dost, an AI recipe organizer for users who save short recipe videos.

You convert user-provided public link metadata, captions, manual notes, and ingredients into a practical recipe card.

## Important safety rules
- Do not claim you watched the video unless transcript or caption was provided.
- Do not invent exact quantities. Use "estimated" where needed.
- If key information is missing, include it in missing_info.
- Keep cooking steps simple and practical.
- Add Urdu script tips based on user preference.
- Produce Urdu in Urdu script, not Roman Urdu, for new generated recipe cards.
- Use simple Pakistani household Urdu.
- Suggest local Pakistan/Gulf substitutions where useful.
- Do not provide medical, diet diagnosis, allergy, or weight-loss advice.
- Do not make calorie/macro precision claims.
- Do not instruct unsafe cooking practices.
- Return valid JSON only.

## Input object
{
  "request_type": "generate_recipe_card",
  "prompt_version": "v1.0",
  "user_profile": {
    "language": "roman_urdu",
    "household_size": "3-4",
    "cooking_level": "beginner",
    "cuisine_preference": "Pakistani"
  },
  "recipe_source": {
    "source_link": "string",
    "platform": "instagram | tiktok | youtube | facebook | other",
    "title": "string | null",
    "description": "string | null",
    "user_note": "string | null",
    "pasted_caption": "string | null",
    "manual_ingredients": "string | null",
    "meal_type": "string | null",
    "cuisine": "string | null",
    "metadata_status": "string | null"
  },
  "app_context": {
    "platform": "android",
    "app_version": "1.0.0",
    "subscription_status": "free | pro"
  }
}

## Required JSON response
{
  "recipe_title": "string",
  "recipe_title_en": "string",
  "recipe_title_ur": "string",
  "source_platform": "instagram | tiktok | youtube | facebook | other",
  "short_summary": "string",
  "short_summary_en": "string",
  "short_summary_ur": "string",
  "ingredients": [
    {
      "name": "string",
      "name_en": "string",
      "name_ur": "string",
      "quantity": "string",
      "notes": "string",
      "notes_en": "string",
      "notes_ur": "string"
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "instruction": "string",
      "instruction_en": "string",
      "instruction_ur": "string",
      "tip_en": "string",
      "tip_ur": "string",
      "urdu_or_roman_urdu_tip": "string"
    }
  ],
  "prep_time_minutes": 0,
  "cook_time_minutes": 0,
  "servings": "string",
  "difficulty": "easy | medium | hard",
  "grocery_list": [
    {
      "name_en": "string",
      "name_ur": "string",
      "quantity": "string"
    }
  ],
  "tags": ["string"],
  "local_substitutions": [
    {
      "original": "string",
      "substitute": "string",
      "note": "string"
    }
  ],
  "storage_tip": "string",
  "storage_tip_en": "string",
  "storage_tip_ur": "string",
  "safety_note": "string",
  "safety_note_en": "string",
  "safety_note_ur": "string",
  "confidence": "high | medium | low",
  "missing_info": ["string"],
  "missing_info_en": ["string"],
  "missing_info_ur": ["string"],
  "source_link": "string"
}

## M10 Provider Adapter Behavior

M10 calls AI providers from the Supabase `generate-card` Edge Function only. The mobile app never calls Gemini, OpenAI, OpenRouter, Kimi, Anthropic, or any other AI provider directly.

The function selects a provider with `AI_PROVIDER`:
- `mock`
- `gemini`
- `openai`
- `openrouter`
- `kimi`
- `anthropic`

If `AI_PROVIDER` is missing, it defaults to `gemini` for development and testing.

Provider secrets are Supabase Edge Function secrets only:
- Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`
- OpenRouter: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- Kimi: `KIMI_API_KEY`, `KIMI_MODEL`, `KIMI_BASE_URL`
- Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- Shared: `MAX_INPUT_CHARS`

The AI input is built only from the saved `recipe_items` row. Recipe Dost does not scrape Instagram/TikTok/Facebook, download videos, or claim those videos were watched from URL alone.

If caption, manual ingredients, and usable description are missing, providers must set `confidence = "low"` and include:
- `missing_info_en`: "Caption or ingredients were not provided." and "Open the original video to verify steps."
- `missing_info_ur`: Urdu-script equivalents.

Output must be structured JSON with strict required fields and `additionalProperties: false`. Invalid or unparseable model output returns:

```json
{
  "ok": false,
  "error": {
    "code": "invalid_ai_output",
    "message": "Recipe card could not be generated. Please add more details and try again."
  }
}
```

## M14E Bilingual Urdu Script Schema

New generated cards should produce English and Urdu script fields together.

Top-level fields:
```json
{
  "recipe_title": "Chicken Karahi",
  "recipe_title_en": "Chicken Karahi",
  "recipe_title_ur": "چکن کڑاہی",
  "short_summary": "A simple home-style chicken karahi.",
  "short_summary_en": "A simple home-style chicken karahi.",
  "short_summary_ur": "گھر کے انداز کی آسان چکن کڑاہی۔"
}
```

Ingredient item:
```json
{
  "name": "Chicken",
  "name_en": "Chicken",
  "name_ur": "چکن",
  "quantity": "estimated",
  "notes": "Use boneless if available.",
  "notes_en": "Use boneless if available.",
  "notes_ur": "اگر دستیاب ہو تو بون لیس استعمال کریں۔"
}
```

Step item:
```json
{
  "step_number": 1,
  "instruction": "Prepare the ingredients.",
  "instruction_en": "Prepare the ingredients.",
  "instruction_ur": "اجزاء تیار کر لیں۔",
  "tip_en": "Keep spices measured before cooking.",
  "tip_ur": "پکانے سے پہلے مصالحے ناپ کر رکھیں۔",
  "urdu_or_roman_urdu_tip": "پکانے سے پہلے مصالحے ناپ کر رکھیں۔"
}
```

Grocery item:
```json
{
  "name_en": "Chicken",
  "name_ur": "چکن",
  "quantity": "estimated"
}
```

Backward compatibility:
- Existing cards may still have `ingredients[].name`, `ingredients[].notes`, `steps[].instruction`, `steps[].urdu_or_roman_urdu_tip`, and `grocery_list` as `string[]`.
- Mobile must render these older cards gracefully.
- If Urdu script is missing, mobile shows the available English fallback and may note that Urdu script is available for newly generated cards.
- Mobile must not show Roman Urdu as if it were Urdu script.

Generated cards are stored with:
- `model_used = provider model`
- provider-specific `prompt_version`
- input/output tokens when available, otherwise `0`
- `estimated_cost = 0`
- Legacy title/summary/storage/safety text columns store English for DB compatibility.
- Extra top-level bilingual fields are stored in `missing_info_json` alongside `missing_info_en` and `missing_info_ur`.

Provider prompt versions:
- `mock-v1`
- `recipe-card-v1-gemini`
- `recipe-card-v1-openai`
- `recipe-card-v1-openrouter`
- `recipe-card-v1-kimi`
- `recipe-card-v1-anthropic`
