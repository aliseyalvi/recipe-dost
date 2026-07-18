# Recipe Dost Data safety inventory

This is an engineering inventory for Play Console preparation, not a legal conclusion. “Shared” classification and retention periods marked **owner/legal confirmation** must be decided against current provider contracts and policies.

| Data | Collected | Shared | Required | Purpose/system | Retention and deletion |
| --- | --- | --- | --- | --- | --- |
| Email | No in current anonymous-only mobile flow | No | No | Supabase Auth supports it technically, but no email UI exists | Reassess if permanent accounts are added |
| Anonymous user UUID | Yes | Service processing; Play “sharing” classification needs owner/legal confirmation | Required | Supabase Auth/RLS; RevenueCat app user; privacy-safe PostHog/Sentry identity | App DB rows cascade on account deletion; provider operational retention needs confirmation |
| Saved source links and notes | Yes | Processed by Supabase/Render/AI provider as needed; classification needs confirmation | User-initiated | Save, metadata, AI recipe generation | Until user deletes recipe/account; worker/provider logs and caches need confirmed periods |
| Generated recipe/metadata | Yes | Service processing by Supabase, Render, selected AI provider | User-initiated | Recipe cards, ingredients, steps, grocery data | Until recipe/account deletion; AI-provider retention needs owner/legal confirmation |
| Grocery lists/collections | Yes | Supabase service processing | Optional | User library and shopping workflow | Until user deletes data/account |
| App interactions | Yes in production | PostHog service processing; classification needs contract review | Analytics optional from product perspective, enabled for production operations | Funnel/product analytics | Current retention setting must be recorded by owner; identity reset on deletion, provider-side erasure behavior needs confirmation |
| Crash/diagnostic data | Yes in production on failures | Sentry service processing; classification needs contract review | Operational | Crash and technical reliability | Current Sentry retention must be recorded; events are sanitized and UUID-only |
| Subscription status/product/access dates | Yes | RevenueCat and Google Play Billing service processing | Required for paid access | Entitlement, purchase/restore/manage | Local DB metadata cascades on deletion; Play/RevenueCat transaction retention is controlled by provider/legal obligations and deletion does not cancel billing |
| AI content report | Yes when submitted | Supabase service processing | Optional | Trust/safety review | Category, optional note, safe recipe-card ID, app/build, timestamp; cascades on account deletion |
| App/device metadata | Yes | PostHog/Sentry and report backend service processing | Operational | Platform, app version, build, sanitized diagnostics | Provider retention needs owner confirmation |
| Raw video/media | No permanent app storage in current link-first flow | Render/AI provider may process temporary authorized media when applicable | Only for supported AI processing | Temporary extraction/generation | Exact temporary worker/provider retention and deletion SLA needs owner/legal confirmation |

All configured network endpoints are HTTPS. Confirm encryption-at-rest claims and contractual service-provider roles before answering Play. Do not classify every processor as “shared” automatically; review whether each provider acts only on the developer’s behalf and whether data is used for independent purposes.

Account deletion removes the Supabase auth user and all currently identified user-owned database records through cascades. It resets local/PostHog/Sentry/RevenueCat identity state. It does not cancel Google Play subscriptions or guarantee deletion of provider billing, security, fraud, or legally retained operational records. Public policy wording must match the confirmed provider retention facts.
