<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Recipe Dost Expo app. A shared PostHog client was configured in `src/config/posthog.ts` using `expo-constants` to read credentials from `app.config.js` extras (sourced from `.env` at build time). The root layout `app/_layout.tsx` wraps the entire app in `PostHogProvider` with autocapture for touch events and manual screen tracking via `posthog.screen()` on each route change. `App.tsx` was also wrapped as a fallback for the current entry. Twelve analytics events mapped to the PRD's event taxonomy have been planned and will be instrumented in their respective screens as they are built.

| Event Name | Description | File |
|---|---|---|
| `onboarding_started` | User begins the onboarding flow for the first time | `app/onboarding/index.tsx` |
| `onboarding_completed` | User finishes all onboarding steps and enters the app | `app/onboarding/index.tsx` |
| `link_pasted` | User pastes or shares a recipe video URL manually | `app/(tabs)/save.tsx` |
| `recipe_link_saved` | User successfully saves a recipe video link to their library | `app/(tabs)/save.tsx` |
| `ai_recipe_started` | AI recipe card generation is triggered for a saved link | `app/recipe/[id]/generate.tsx` |
| `ai_recipe_completed` | AI recipe card was generated successfully (first value moment) | `app/recipe/[id]/generate.tsx` |
| `ai_recipe_failed` | AI recipe card generation failed due to an error | `app/recipe/[id]/generate.tsx` |
| `grocery_list_created` | User generates a grocery list from selected recipes | `app/(tabs)/grocery.tsx` |
| `paywall_viewed` | User sees the paywall screen after hitting free usage limits | `app/paywall.tsx` |
| `purchase_completed` | User successfully completes a subscription purchase | `app/paywall.tsx` |
| `recipe_shared` | User shares a recipe card externally via the share sheet | `app/recipe/[id]/index.tsx` |
| `recipe_searched` | User performs a search query in the recipe library | `app/(tabs)/library.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) Dashboard](https://us.posthog.com/project/478864/dashboard/1739079)
- [Recipe Saves Over Time](https://us.posthog.com/project/478864/insights/WDg34Amf)
- [AI Recipe Generation Success vs Failure](https://us.posthog.com/project/478864/insights/sy0bjIwD)
- [Core Activation Funnel](https://us.posthog.com/project/478864/insights/YtncHolT) — link_pasted → recipe_link_saved → ai_recipe_completed
- [Paywall Views & Purchases](https://us.posthog.com/project/478864/insights/dA7iA44X)
- [Onboarding Completion Funnel](https://us.posthog.com/project/478864/insights/ieTViliz)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` to `.env.example` and any CI/bootstrap scripts so collaborators know what to set.
- [ ] As each screen is built (`app/onboarding/index.tsx`, `app/(tabs)/save.tsx`, `app/recipe/[id]/generate.tsx`, etc.), add the `posthog.capture(...)` calls listed in the table above.
- [ ] Confirm the returning-visitor path also calls `identify` — a handler that only identifies on fresh login can leave returning sessions on anonymous distinct IDs.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-expo/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
