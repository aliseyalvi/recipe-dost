# Recipe Dost QA Checklist

## Save link flow
- Paste valid YouTube Shorts link
- Paste valid Instagram Reel link
- Paste valid TikTok link
- Paste Facebook video link
- Paste invalid URL
- Empty URL validation
- Metadata success
- Metadata failure fallback
- Manual caption fallback
- Manual ingredients fallback

## AI recipe flow
- First AI recipe card generated successfully
- Missing quantities marked as estimated
- Missing info displayed
- Urdu/Roman Urdu tip displays correctly
- Safety note appears
- Source link opens original platform
- Result saves to library

## Free limits
- First result free
- 3 AI cards allowed
- 4th AI card triggers paywall
- 20 saved links limit enforced
- 3 grocery lists limit enforced

## Grocery list
- Create grocery list from one recipe
- Create grocery list from multiple recipes
- Duplicate ingredients grouped where possible
- Copy/share works

## Reliability
- Offline state
- Backend error state
- Retry button
- Loading state
- Empty state
- Sentry receives test error
- PostHog receives funnel events

## Account/legal
- Settings opens
- Support message works
- Privacy link opens
- Terms link opens
- Delete account flow works
