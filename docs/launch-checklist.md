# Recipe Dost Launch Checklist

## Store basics
- Google Play developer identity/phone verification completed
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

## Google Play verification wait-state
- External blocker: Google Play developer identity/phone verification is pending
- Continue while waiting: store listing copy
- Continue while waiting: screenshots
- Continue while waiting: privacy policy
- Continue while waiting: data safety draft
- Continue while waiting: app access instructions
- Continue while waiting: content rating draft
- Continue while waiting: RevenueCat product plan
- Blocked until verification if Console blocks access: Play app/internal test upload
- Blocked until verification if Console blocks access: Play subscriptions/base plans
- Blocked until verification if Console blocks access: RevenueCat Google Play product import
- Blocked until verification if Console blocks access: sandbox purchase test

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
