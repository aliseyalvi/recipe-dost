# One-Page PRD — SV003: AI Recipe Reel Saver

## 0. Product Decision

| Item                                          | Decision                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Idea ID                                       | SV003                                                                                                            |
| Concept                                       | AI recipe saver for Reels, TikToks, Shorts, and social food videos                                               |
| Current decision                              | Maybe Later                                                                                                      |
| Build before Interview Dost?                  | No                                                                                                               |
| Build before SV008 creator/agency swipe file? | No, unless recipe validation becomes stronger                                                                    |
| MVP type                                      | Android-first, link-first AI recipe organizer                                                                    |
| Compliance stance                             | Save links, notes, user-created recipe cards, and legal metadata only. Do not download or back up actual videos. |

## 1. App Name Options

| Rank | Name            | Notes                                        |
| ---: | --------------- | -------------------------------------------- |
|    1 | Recipe Dost     | Best Pakistan/local emotional fit            |
|    2 | ReelRecipe AI   | Clear global positioning                     |
|    3 | CookSave AI     | Simple and utility-focused                   |
|    4 | Bawarchi AI     | Strong Urdu/Pakistan flavor, but less global |
|    5 | Recipe Vault AI | Safe and broad                               |

**Recommended working name:** Recipe Dost
**Store subtitle:** Save Recipe Reels as Steps
**One-line positioning:** Recipe Dost turns saved food Reels, TikToks, and Shorts into clean recipe cards with ingredients, steps, notes, and Urdu/Roman Urdu instructions.

## 2. Target User

| Persona             | Details                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Primary user        | Home cooks who save recipe videos but never find or cook them later                                    |
| Secondary user      | Food creators, meal planners, moms/home chefs, students living away from home                          |
| Local wedge         | Pakistani/Urdu-English users who save food videos and want simple Urdu/Roman Urdu cooking instructions |
| Device focus        | Android-first                                                                                          |
| Existing workaround | Instagram saves, TikTok favorites, YouTube playlists, screenshots, WhatsApp self-chat, notes app       |
| Main frustration    | Recipe videos are easy to save but hard to turn into usable ingredients, quantities, and cooking steps |

## 3. Specific Pain

Users save many recipe Reels/TikToks/Shorts, but when they want to cook later, the video is buried, ingredients are unclear, quantities are missing, steps are not written, and saved videos are scattered across apps.

## 4. One-Sentence Promise

Save any recipe Reel, TikTok, or Short link and turn it into a clean recipe card with ingredients, steps, grocery list, tags, and Urdu/Roman Urdu cooking notes.

## 5. Why Now

Short-form recipe videos are everywhere, but they are not optimized for actual cooking. AI can convert messy captions, titles, notes, and available metadata into structured recipe cards, making saved videos more useful without downloading the original video.

## 6. Why Users Pay

| User Type               | Why They Pay                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| Home cook               | Saves time rewriting ingredients and steps                           |
| Meal planner            | Builds weekly cooking list from saved videos                         |
| Pakistani home chef     | Gets Urdu/Roman Urdu instructions and local ingredient substitutions |
| Food creator            | Organizes recipe ideas and recreates content                         |
| Student / beginner cook | Gets simplified steps and cooking notes                              |

## 7. Main Feature

**AI Recipe Card from Saved Link**

User shares or pastes a food-video link. The app saves the link and user note, then generates a structured recipe card.

| AI Output             | Example                                     |
| --------------------- | ------------------------------------------- |
| Recipe title          | Creamy Chicken Pasta                        |
| Ingredients           | Chicken, pasta, cream, garlic, black pepper |
| Estimated quantities  | 250g chicken, 1 cup pasta, 1/2 cup cream    |
| Cooking steps         | Boil pasta → cook chicken → add sauce → mix |
| Prep/cook time        | 10 min prep, 20 min cook                    |
| Serving size          | 2–3 people                                  |
| Difficulty            | Easy                                        |
| Grocery list          | Chicken, pasta, cream, garlic               |
| Tags                  | pasta, chicken, dinner, quick meal          |
| Urdu/Roman Urdu notes | “Pasta ko zyada overcook na karein.”        |
| Source link           | Opens original video on original platform   |

## 8. First Free Value Moment

The user saves one recipe video link and gets:

**Recipe title → ingredients → cooking steps → grocery list → Urdu/Roman Urdu explanation**

This should happen before any paywall.

## 9. Paywall Trigger

| Trigger                        | Decision           |
| ------------------------------ | ------------------ |
| Before first save              | Avoid              |
| After onboarding               | Avoid              |
| After first recipe card        | Recommended        |
| After 3 free recipe cards      | Softer alternative |
| When creating weekly meal plan | Pro trigger        |
| When using grocery list export | Pro trigger        |
| When saving unlimited recipes  | Pro trigger        |

## 10. MVP Screens

| Screen                    | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| Splash / loading          | App init, auth, subscription check                              |
| Welcome                   | “Save recipe videos as clean recipe cards”                      |
| Onboarding                | Select cooking style, language, optional preferences, household size |
| Home                      | Greeting, promise card, compliance note, how-it-works steps, recent recipes, quick actions |
| Save Link / Share Capture | Accept URL from Android share sheet or paste manually           |
| Preview & Add Note        | Show link, platform, optional thumbnail/title, user note        |
| AI Recipe Result          | Ingredients, steps, grocery list, time, serving size, tags      |
| Recipe Library            | Saved recipes by cuisine, meal type, platform, tags             |
| Search                    | Search by ingredient, recipe name, cuisine, occasion            |
| Grocery List              | Combined ingredients from selected recipes                      |
| Paywall                   | Unlock unlimited recipes, meal plans, grocery export            |
| Settings                  | Language, subscription, support, privacy, terms, delete account |

## 11. Onboarding Flow

| Screen                 | Copy / Question                                           | Options                                                                     | Required? | Saved Field            |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- | --------- | ---------------------- |
| Welcome                | Save recipe videos as clean recipe cards                  | CTA: Start Free                                                             | Yes       | n/a                    |
| Cooking Style          | What do you cook most?                                    | Pakistani, Indian, Arabic, Western, Chinese, Baking, Mixed                  | Yes       | cuisine_preference     |
| Preferred Language     | How should Recipe Dost explain recipes?                   | English, Urdu, Roman Urdu, Both                                             | Yes       | language               |
| Household Size         | How many people do you usually cook for?                  | 1, 2, 3-4, 5+                                                               | Yes       | household_size         |
| Cooking Level          | What is your cooking level?                               | Beginner, Average, Confident                                                | Yes       | cooking_level          |
| Main Use + Preferences | What do you want to use Recipe Dost for?                  | Save recipes, Meal planning, Grocery list, Food content ideas               | Yes       | main_use               |
| Optional Preferences   | Optional preference chips on the Main Use screen          | Budget meals, Quick meals, Healthy-ish, Kids meals, Ramadan/Iftar, Desserts | No        | cooking_preferences    |

Welcome subtext: "Turn Reels, TikToks, Shorts, and food videos into ingredients, steps, grocery lists, and Urdu/Roman Urdu cooking notes."

Trust note: "We save recipe cards and links, not video files."

Preferred Language helper: "You can change this later in Settings."

Household Size helper: "We will estimate servings and grocery quantities better."

Cooking Level helper: "Beginner mode gives simpler steps and extra tips."

Avoid medical/diet diagnosis. Preferences are for organization only, not medical nutrition advice. Do not make calorie, allergy, medical diet, or weight-loss claims.

Onboarding persists locally first and saves to `user_profiles` for the current anonymous Supabase user. `onboarding_completed` is set to true only after successful finish. If Supabase save fails, users can retry or continue later with local data while Supabase remains incomplete where possible.

## 12. Input Fields

| Field              | Required?                                                 |
| ------------------ | --------------------------------------------------------- |
| Source URL         | Required                                                  |
| Platform           | Auto-detected if possible                                 |
| User note          | Optional but encouraged                                   |
| Recipe category    | Optional                                                  |
| Language           | From onboarding                                           |
| Household size     | From onboarding                                           |
| Manual ingredients | Optional fallback                                         |
| Meal type          | Optional: breakfast, lunch, dinner, snack, dessert, iftar |
| Cuisine            | Optional                                                  |

## 12.1 Home Dashboard

After onboarding, users land on Home. Home should remind users that Recipe Dost is link-first and does not save video files.

Home sections:
- Header greeting: "Assalam o Alaikum 👋" for Urdu/Roman Urdu users, otherwise "Welcome back".
- Main promise card: "Stop losing recipe Reels" with CTAs for Save Recipe Link and View Library.
- Trust note: "Recipe Dost saves recipe cards and links, not video files."
- How it works: paste a recipe video link, add notes or caption if needed, get ingredients, steps, and grocery list.
- Recent recipes: show the latest 3 `recipe_items` for the current user with title, platform, created date, metadata status, and thumbnail when available.
- Quick actions: Library, Grocery List, Settings.

Home must include loading, empty, error, and retry states for recent recipes. The Save Link CTA navigates to the M5 placeholder until the real save flow is built.

## 12.2 Save Link + Preview Flow

M5 adds the front-end-only save link draft flow:
- Home CTA opens `/save-recipe`.
- Save Link validates a pasted http/https recipe video URL and detects platform locally.
- Preview & Add Note uses a local persisted draft store instead of long route params.
- Preview captures optional user note, pasted caption, manual ingredients, meal type, and cuisine.
- Save Link in Preview stores the draft locally and routes to a safe placeholder for future backend saving and AI recipe card generation.

M5 does not insert into `recipe_items`, call `parse-url`, call Edge Functions, fetch metadata, generate AI recipe cards, download videos, or scrape content.

## 13. AI Output Format

```json
{
  "recipe_title": "string",
  "source_platform": "instagram | tiktok | youtube | facebook | other",
  "short_summary": "string",
  "ingredients": [
    {
      "name": "string",
      "quantity": "string",
      "notes": "string"
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "instruction": "string",
      "urdu_or_roman_urdu_tip": "string"
    }
  ],
  "prep_time_minutes": 0,
  "cook_time_minutes": 0,
  "servings": "string",
  "difficulty": "easy | medium | hard",
  "grocery_list": ["string"],
  "tags": ["string"],
  "local_substitutions": [
    {
      "original": "string",
      "substitute": "string",
      "reason": "string"
    }
  ],
  "storage_tip": "string",
  "safety_note": "string",
  "confidence": "high | medium | low",
  "missing_info": ["string"],
  "source_link": "string"
}
```

## 14. Safe Platform Strategy

| Area                          | MVP Decision                                              |
| ----------------------------- | --------------------------------------------------------- |
| Save actual videos            | No                                                        |
| Download recipe videos        | No                                                        |
| Backup deleted videos         | No                                                        |
| Save links                    | Yes                                                       |
| Save user notes               | Yes                                                       |
| Save AI recipe cards          | Yes                                                       |
| Fetch title/caption/thumbnail | Only if legally/reliably available                        |
| Use transcript/caption        | Only if safely available                                  |
| Manual fallback               | User can paste caption or ingredients if metadata fails   |
| Open original video           | Yes, open source link                                     |
| Export                        | Later: export recipe cards, grocery lists, and links only |

## 15. Free Plan

| Feature                |                    Free Limit |
| ---------------------- | ----------------------------: |
| Saved recipe links     |                      20 total |
| AI recipe cards        |                       3 total |
| Grocery lists          |                       3 lists |
| Basic search           |                      Included |
| Urdu/Roman Urdu output | Included within free AI limit |
| Collections            |                 2 collections |
| Meal plan              |            Locked or 1 sample |
| Export                 |                        Locked |

## 16. Paid Plan

| Plan                    | Price Hypothesis                              | Includes                                                               |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Recipe Dost Pro Monthly | $3.99–$5.99 global; Rs 499–999 Pakistan       | More recipe cards, grocery lists, search, collections                  |
| Recipe Dost Pro Annual  | $24.99–$39.99 global; Rs 3,999–7,999 Pakistan | Discounted yearly access                                               |
| Lifetime later          | $29.99–$49.99 global                          | Possible Android utility monetization, but AI fair-use limits required |

## 17. Pro Benefits

| Feature                          | Why It Converts                      |
| -------------------------------- | ------------------------------------ |
| More AI recipe cards             | Core usage limit                     |
| Unlimited/fair-use saved recipes | Heavy savers need this               |
| Grocery list generator           | Practical cooking utility            |
| Weekly meal planner              | Better retention loop                |
| Ingredient search                | “What can I cook with chicken?”      |
| Urdu/Roman Urdu instructions     | Local differentiation                |
| Local substitutions              | Useful for Pakistan/Gulf ingredients |
| Export to PDF/WhatsApp           | Useful for family sharing            |
| Google Drive export later        | Trust/backup feature                 |

## 18. Analytics Events

| Event                      | Purpose               |
| -------------------------- | --------------------- |
| app_opened                 | App usage             |
| onboarding_started         | Funnel start          |
| onboarding_completed       | Personalization       |
| share_capture_started      | Share-sheet tracking  |
| link_pasted                | Manual save tracking  |
| metadata_fetch_started     | Metadata pipeline     |
| metadata_fetch_completed   | Metadata reliability  |
| recipe_save_preview_viewed | Save flow progress    |
| recipe_link_saved          | Core activation       |
| ai_recipe_started          | AI usage              |
| ai_recipe_completed        | First value moment    |
| ai_recipe_failed           | Reliability           |
| grocery_list_created       | Utility activation    |
| recipe_searched            | Retention behavior    |
| collection_created         | Organization behavior |
| paywall_viewed             | Monetization          |
| trial_started              | Conversion            |
| purchase_completed         | Revenue               |
| recipe_shared              | Viral loop            |
| export_clicked             | Future Pro demand     |
| delete_account_clicked     | Compliance            |

## 19. Backend / API Needs

| Endpoint                           | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| POST /v1/auth/anonymous            | Create guest user                           |
| POST /v1/recipes/parse-url         | Detect platform and fetch safe metadata     |
| POST /v1/recipes                   | Save recipe link and note                   |
| POST /v1/recipes/:id/generate-card | Generate AI recipe card                     |
| GET /v1/recipes                    | Recipe library                              |
| GET /v1/recipes/:id                | Recipe detail                               |
| PATCH /v1/recipes/:id              | Edit title, notes, tags, ingredients        |
| DELETE /v1/recipes/:id             | Delete saved recipe                         |
| POST /v1/grocery-list              | Generate grocery list from selected recipes |
| POST /v1/search                    | Search recipes                              |
| GET /v1/subscription/status        | RevenueCat entitlement mirror               |
| POST /v1/revenuecat/webhook        | Sync purchases                              |
| POST /v1/support                   | Support message                             |
| DELETE /v1/account                 | Delete user data                            |

## 20. Database Entities

| Entity              | Key Fields                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| users               | id, auth_provider, email, platform, created_at, deleted_at                                                       |
| user_profiles       | user_id, language, household_size, cooking_level, cuisine_preference                                             |
| recipe_items        | id, user_id, source_url, platform, title, description, thumbnail_url, metadata_status, created_at                |
| recipe_cards        | recipe_id, summary, ingredients_json, steps_json, time_json, servings, difficulty, tags_json, substitutions_json |
| collections         | id, user_id, name, type, created_at                                                                              |
| grocery_lists       | id, user_id, title, items_json, source_recipe_ids, created_at                                                    |
| usage_counters      | user_id, period, recipe_cards_used, grocery_lists_used, estimated_cost                                           |
| subscriptions       | user_id, revenuecat_app_user_id, entitlement, status, product_id, expires_at                                     |
| metadata_fetch_logs | recipe_id, provider, status, error_code, fetched_at                                                              |
| support_tickets     | user_id, issue_type, message, status, created_at                                                                 |

## 21. Risks

| Risk                          |    Severity | Mitigation                                                                   |
| ----------------------------- | ----------: | ---------------------------------------------------------------------------- |
| Crowded recipe app market     |        High | Differentiate with short-video link capture + Urdu/Roman Urdu + grocery list |
| Platform metadata fails       |        High | User note/caption paste fallback                                             |
| AI hallucinates quantities    |        High | Mark estimated quantities and show confidence/missing info                   |
| Food safety issues            | Medium-high | Add basic safety notes; avoid medical/nutrition claims                       |
| Users expect video backup     |        High | Clear copy: “We save recipe cards and links, not video files.”               |
| Weak subscription willingness | Medium-high | Test lifetime purchase or low monthly pricing                                |
| AI cost                       |      Medium | Fair-use limits, cache recipe cards                                          |
| Retention                     |      Medium | Weekly meal plan and grocery list loops                                      |
| Local ingredient mismatch     |      Medium | Add local substitutions and editable ingredients                             |

## 22. Features To Avoid In V1

* Downloading videos
* Offline video backup
* “Save deleted recipe videos forever”
* Scraping private saved folders
* Auto-importing Instagram/TikTok saved recipes
* Medical diet plans
* Weight-loss claims
* Allergy/health diagnosis
* Calorie/macro precision claims
* Complex meal-plan calendar
* Family/team accounts
* Voice cooking assistant
* Full pantry management
* Delivery/grocery ordering
* Token bundles

## 23. 30-Day Build Plan

| Week   | Goal                             | Tasks                                                                                                   |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Week 1 | Product and technical foundation | Finalize name, wireframes, API contract, DB schema, AI prompt, metadata fallback strategy               |
| Week 2 | Core recipe save flow            | Expo app shell, onboarding, home, Android share intent, paste URL fallback, recipe preview, collections |
| Week 3 | AI recipe card + grocery list    | Backend AI endpoint, recipe card UI, grocery list generator, basic search, usage limits                 |
| Week 4 | Monetization + QA                | RevenueCat paywall, PostHog, Sentry, test 50 recipe links, app store copy, demo videos, beta testers    |

## 24. Launch Angle

**Main angle:**
“Stop losing recipe Reels. Turn saved food videos into ingredients, steps, and grocery lists.”

**Pakistan/local angle:**
“Save any recipe Reel and get simple Urdu/Roman Urdu cooking steps.”

**Practical utility angle:**
“From saved video to grocery list in 10 seconds.”

## 25. 10 Short-Form Content Hooks

|  # | Hook                                                             |
| -: | ---------------------------------------------------------------- |
|  1 | You saved 200 recipe Reels… but what are you cooking tonight?    |
|  2 | Stop scrolling saved videos just to find one chicken recipe.     |
|  3 | Save a recipe Reel. Get ingredients and steps instantly.         |
|  4 | This app turns TikTok recipes into clean grocery lists.          |
|  5 | I built an app for people who save recipes but never cook them.  |
|  6 | Before: messy saved Reels. After: recipe cards and grocery list. |
|  7 | Pakistani recipe Reel? Get Roman Urdu cooking steps instantly.   |
|  8 | Don’t screenshot recipes anymore. Save them properly.            |
|  9 | From one food Reel to a full recipe card in 10 seconds.          |
| 10 | Your saved recipe folder is not a cookbook. This fixes it.       |

## 26. Success Metrics For MVP

| Metric                          |                   Target |
| ------------------------------- | -----------------------: |
| First recipe save completion    |  45%+ of onboarded users |
| First AI recipe card completion |  35%+ of onboarded users |
| Recipe card success rate        |                     80%+ |
| Grocery list creation rate      |  20%+ of activated users |
| Paywall view rate               |  45%+ of activated users |
| Trial / purchase start          | 2.5%+ of activated users |
| D1 retention                    |                     25%+ |
| D7 retention                    |                   8–10%+ |
| Weekly active savers            |                     15%+ |
| AI generation failure           |                 Under 5% |
| Metadata fallback success       |                     90%+ |
| Crash-free sessions             |                     99%+ |
