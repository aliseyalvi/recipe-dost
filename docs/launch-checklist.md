# Recipe Dost Launch Checklist

## Store basics
- Google Play developer identity/phone verification completed
- Release branch is `main`
- `develop` QA completed before merge to `main`
- Production env checked with `npm run env:doctor:prod`
- Production EAS AAB build completed and artifact available
- Google Play app created with package ID com.recipedost.app
- App name selected
- App icon created
- 6 Android screenshots created
- Short description written
- Full description written
- Privacy policy URL live
- Terms URL live
- Support email works

## Google Play internal testing state
- Production backend and worker smoke tests passed
- RevenueCat production setup working
- Google Play internal testing working
- Sandbox purchase test working
- Next production AAB update follows `develop` QA, merge to `main`, `npm run build:prod`, then Play internal update

## Compliance
- App does not claim to download videos
- App does not claim to back up deleted videos
- AI-generated recipe content disclosed
- Subscription terms shown near CTA
- Restore purchases visible
- Delete account available
- No medical/diet/weight-loss claims

## Monetization
- RevenueCat project created
- Android app configured
- Entitlement: premium
- Products: recipe_dost_premium_monthly, recipe_dost_premium_yearly
- Base plans: monthly-autorenewing, yearly-autorenewing
- Offering: default
- Note: Google Play/RevenueCat may identify products as subscription_id:base-plan-id.
- Production uses EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY with a real Google Play-backed RevenueCat Android public SDK key
- Production env validation rejects RevenueCat Test Store keys
- Development/Test Store keys are used only in development and only after Test Store products are registered manually in RevenueCat
- Paywall shows "Plans unavailable right now" if offerings/packages are empty and keeps Restore purchases visible
- Paywall after first result
- Purchase tested
- Restore tested

## Analytics
- PostHog key added
- app_opened tracked
- onboarding_completed tracked
- recipe_link_saved tracked
- ai_recipe_completed tracked
- paywall_viewed tracked
- purchase_completed tracked

## QA
- M22E bug fixes completed on `develop` first
- M22E.1C competitor UX decisions documented before implementation
- Competitor UX cherry-picks avoid nutrition, meal planner, scaling, PDF export, AI edit, photo import, folders/cookbooks, push notifications, and video downloading/storage
- M22E.1D app-side/UI-only implementation complete before schema/backend work
- M22E.1D Library search checked by title, ingredient, tag, platform/source, and AI step text
- M22E.1D AI tag chips checked on new cards and old cards without tags
- M22E.1D paywall comparison checked without changing products, entitlement, or quota limits
- M22E.1D favorite/delete/manual tags remain deferred until a separate schema-backed dev QA patch
- M22E.1E processing actions checked: Go back to Home/Library, Wait here, complete auto-open, and failed retry state
- M22E.1E paywall copy checked: Free = 3 total AI recipe cards, unlimited saved links, Premium = 100 AI recipe cards/month
- M22E.1E usage card checked against backend access state without changing quota/access logic
- M22E.1R-C Library search checked by title, AI title, source author/platform, ingredient, step, and generated tag
- M22E.1R-C tag tap opens Library with a prefilled query; raw search/tag values are not sent to analytics
- M22E.1R-C active search rows checked on a small Android screen for thumbnail, badges, time/servings, tag-chip, and no-results overflow
- M22E.1R-C no-results state checked with clear-search/filters action; older empty-tag recipe cards still open cleanly
- M22E.1R-D development migration `20260711080652_m22e_recipe_management.sql` applied and verified before production consideration
- M22E.1R-D favorite/unfavorite checked from saved-link and AI-card detail, including Home/Library persistence after restart
- M22E.1R-D delete confirmation checked from both detail surfaces; deleted recipe absent from Home, Library/Search, detail, and grocery views
- M22E.1R-D RLS/ownership checked with a second dev identity; no quota, paywall, RevenueCat, or original-video behavior changed
- Production AAB created only from `main` with `npm run build:prod`
- Production env never manually sourced in a normal terminal
- 50 recipe links tested
- Metadata fallback success checked
- Crash-free basic flow
- Internal Android build tested on real device
