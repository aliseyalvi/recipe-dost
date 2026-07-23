# M24.3A Subscription Mobile QA Runbook

## Scope and prerequisites

This is a manual Android development-build check after the M24.3A source is
included in a new binary. Use the development Supabase project and RevenueCat
Test Store account. Do not extend an expired test purchase or change backend
quota/configuration to force a result.

Before testing, confirm the authenticated Supabase UUID is the expected test
profile and retain backend evidence for `get-ai-access` and the safe
subscription-sync event names. Never record raw IDs, tokens, receipts, or
subscriber payloads in screenshots or logs.

## Manual scenarios

1. Start with no active store entitlement and an exhausted Free allowance.
   Open Settings twice. It must show Free or expired, never Premium, and the
   second mount must not start another synchronization within 60 seconds.
2. Tap Restore with no active entitlement. The final message must be “No active
   subscription was found for this store account.” If RevenueCat exposes a known
   past expiry, it must instead say “Your previous subscription has expired.”
3. Tap Refresh status. It must invalidate/fetch CustomerInfo, synchronize once,
   fetch `get-ai-access` once, and always clear the busy state. It must not call
   Restore.
4. Complete one Test Store Premium purchase. While backend confirmation is
   pending, the paywall remains open and says “Purchase found. Verifying your AI
   access…”. It may close as soon as backend Premium is confirmed, even if
   current quota/reservation state prevents another AI job.
5. Generate from a profile that receives `premium_sync_required`. Verify one
   reconciliation followed by at most one automatic `create-media-job` retry.
   Confirm one job exists and the old “Please try again” success message is absent.
6. Let the Test Store entitlement expire naturally. Refresh once. Settings,
   paywall, and recipe detail must show expired/Free, the 100-month allowance
   must not return, and generation must remain blocked when Free is exhausted.
7. Background the app for less than 60 seconds and return: no reconciliation.
   Repeat after the cache is stale: one silent reconciliation. Navigate among
   Home, Library, Grocery, Settings, paywall, and recipe detail and confirm they
   share the same backend snapshot.
8. Cause a temporary provider/network failure after a confirmed Premium result.
   The UI may retain the last confirmed Premium snapshot with the verification
   warning. Then supply a known backend expired/Free response and verify Premium
   is no longer retained.
9. Exercise a development binding-conflict fixture. No screen may claim restored
   access; the user sees the safe support-oriented message.
10. With backend `premiumActive=true` and monthly usage at 100, tap Restore.
    Confirm “Premium access has been restored,” Settings remains Premium, and
    usage says all 100 recipes were used. Generate stays disabled without opening
    the purchase flow or synchronizing again.
11. With backend Premium and one blocking active reservation, confirm Settings
    and paywall remain Premium and say an AI recipe is already being processed.
    Generate stays disabled and no second media job is created.

## Evidence and release gate

Capture safe counts for SDK restore/purchase, sync endpoint calls,
`get-ai-access`, and `create-media-job`; final state/copy; listener cleanup across
an identity change; and the allowlisted analytics events. M24.3A cannot ship until
all scenarios pass on the intended new binary. The existing closed-testing binary
remains backend-compatible but does not contain this UX repair.

## Rollback

Rollback is source/mobile-release only: revert the M24.3A mobile commit and do not
promote the candidate binary. No database, Edge Function, worker, RevenueCat
dashboard, or backend quota rollback is required. If a candidate was distributed,
halt its rollout and retain the last known-good binary while investigating.
