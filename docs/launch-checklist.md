# Recipe Dost Launch Checklist

## Store basics
- App name selected
- App icon created
- 6 Android screenshots created
- Short description written
- Full description written
- Privacy policy URL live
- Terms URL live
- Support email works

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
- 50 recipe links tested
- Metadata fallback success checked
- Crash-free basic flow
- Internal Android build tested on real device
