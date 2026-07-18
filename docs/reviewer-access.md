# Google Play reviewer access template

## App access declaration

Recipe Dost has no email/password gate. It creates an anonymous authenticated app profile during startup, so all reviewable functionality is available without special credentials.

- Reviewer email: `N/A — no email sign-in in this build`
- Reviewer password: `N/A — no password sign-in in this build`
- Expected startup wait: `[owner enters measured typical production wait]`
- External availability notes: `[owner confirms Supabase, Render worker, AI provider, RevenueCat and Google Play test availability]`

## Reviewer steps

1. Launch Recipe Dost and wait for branded startup.
2. On a fresh install, complete or Skip the five-screen Welcome flow.
3. From Home, tap Add Recipe and paste `[owner supplies a stable supported public recipe URL]`.
4. Save the link. Saving/sharing must not create a media job.
5. Open the saved recipe and select Generate AI Recipe. Wait `[owner supplies typical processing time]`.
6. Open the AI recipe card and its options menu; choose **Report AI Recipe**, select a category, and submit without private text.
7. Open Grocery from the bottom tab or AI recipe action.
8. Open Premium from Settings/usage gate. Prices are loaded from Google Play; Restore purchases is visible.
9. Account deletion is Settings → Privacy & Data → Delete account & data.
10. Privacy Policy, Terms, public deletion instructions, and Support open configured public HTTPS pages.

If Play Console still requests credentials, explain that the app uses a transparent anonymous Supabase session and does not expose email/password authentication. Do not place production secrets, tokens, or reviewer credentials in Git.
