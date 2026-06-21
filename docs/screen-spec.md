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
