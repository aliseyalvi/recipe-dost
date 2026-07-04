# Recipe Dost QA Scenarios

Use this checklist for focused human QA. Keep notes short, and do not paste secrets, full source URLs, CDN URLs, cookies, temp paths, or raw worker payloads.

## 1. Normal Launch

- Steps: Open the Android dev build normally with no share intent.
- Expected result: Home loads without opening the save modal or showing a share error.
- Optional SQL/log check: None.
- Pass/fail notes:

## 2. Manual Plus/Save URL

- Steps: Tap the center plus action, paste a supported recipe URL, and save.
- Expected result: Save modal closes, a saved-link card appears, and metadata refresh starts in the background.
- Optional SQL/log check: Confirm a `recipe_items` row exists for the user.
- Pass/fail notes:

## 3. Android Share URL

- Steps: Share a supported recipe URL from another Android app into Recipe Dost, then save.
- Expected result: Recipe Dost opens the save modal prefilled with the shared URL and saves through the same saved-link flow.
- Optional SQL/log check: Confirm no AI job is created by the share/save action.
- Pass/fail notes:

## 4. Duplicate URL Save

- Steps: Save the same source URL twice through manual save or share.
- Expected result: The app blocks or reuses the existing saved item and does not show a duplicate card.
- Optional SQL/log check: Confirm only one active saved item for the normalized source key.
- Pass/fail notes:

## 5. Metadata Refresh

- Steps: Save a link with pending metadata, wait for refresh, then retry if needed.
- Expected result: Title, thumbnail, platform, and duration update when available; failure leaves the saved link usable.
- Optional SQL/log check: Inspect safe `recipe_items.source_metadata` fields and `metadata_status`.
- Pass/fail notes:

## 6. Home/Library Card Display

- Steps: Review saved links, pending metadata items, AI recipe cards, and failed AI states on Home and Library.
- Expected result: Cards show the right title, thumbnail, status pill, and platform text without duplicated labels or visual overlap.
- Optional SQL/log check: Compare visible state against `recipe_items`, `media_jobs`, and linked `recipe_cards`.
- Pass/fail notes:

## 7. Source/Saved Recipe Detail

- Steps: Open a saved-link card from Home and Library.
- Expected result: Detail screen shows source information, retry details when metadata fails, and Generate AI Recipe when allowed.
- Optional SQL/log check: None unless visible state disagrees with the database.
- Pass/fail notes:

## 8. Generate AI Recipe

- Steps: Open a valid saved-link detail and tap Generate AI Recipe.
- Expected result: The app creates an AI job, shows analyzing/progress state, and prevents duplicate starts.
- Optional SQL/log check: Confirm one `media_jobs` row is created only after tapping Generate AI Recipe.
- Pass/fail notes:

## 9. AI Result Auto-Open

- Steps: Start AI generation from Source Detail and wait for completion.
- Expected result: Completed AI recipe opens automatically once, and back navigation returns to the parent screen.
- Optional SQL/log check: Confirm completed `media_jobs.result_recipe_card_id` points to a `recipe_cards` row.
- Pass/fail notes:

## 10. Free AI Credit Reservation

- Steps: With a free user, start AI jobs until the 3-generation limit behavior is visible.
- Expected result: Active jobs reserve slots, successful jobs count permanently, and failed jobs release reserved credit.
- Optional SQL/log check: Compare access summary with successful and active AI media jobs.
- Pass/fail notes:

## 11. Grocery Root/Detail

- Steps: Open Grocery root, then open a recipe-specific grocery list.
- Expected result: Root lists available grocery lists, detail shows checklist items with the correct thumbnail/title context.
- Optional SQL/log check: Confirm grocery rows derive from existing `recipe_cards` grocery or ingredient data.
- Pass/fail notes:

## 12. Back Navigation

- Steps: Navigate Home, Library, Source Detail, AI Recipe detail, Grocery root, and Grocery detail; use the visible back controls.
- Expected result: Back returns to the correct parent without duplicate Home stack entries or trapped detail screens.
- Optional SQL/log check: None.
- Pass/fail notes:

## 13. Offline/Network Handling

- Steps: Load cached screens, disable network, then refresh or retry Home, Library, Source Detail, AI access, and Grocery.
- Expected result: Cached data remains visible where available, friendly offline copy appears, and retry recovers when network returns.
- Optional SQL/log check: None.
- Pass/fail notes:

## 14. Long Video >120 Seconds Handling

- Steps: Save a source known to be over 120 seconds and attempt Generate AI Recipe after metadata duration is available.
- Expected result: The app blocks or fails gracefully with friendly long-video copy and preserves the original saved link.
- Optional SQL/log check: Confirm no successful AI credit is permanently consumed.
- Pass/fail notes:

## 15. Thumbnail Trace/Source QA

- Steps: Compare platform thumbnails before and after AI generation for saved links and AI cards.
- Expected result: Platform thumbnails stay preferred for source cards and are not downgraded by AI job thumbnails.
- Optional SQL/log check: Inspect safe thumbnail trace fields only, never direct CDN/video URLs.
- Pass/fail notes:

## 16. No Media Job From Save/Share

- Steps: Save a URL manually and through Android share without tapping Generate AI Recipe.
- Expected result: Save/share creates or reuses saved links only; no media job or AI credit reservation occurs.
- Optional SQL/log check: Confirm no new `media_jobs` row exists for save/share-only actions.
- Pass/fail notes:
