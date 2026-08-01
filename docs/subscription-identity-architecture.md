# Subscription and Identity Architecture

## Ownership boundaries

- Supabase `auth.users.id` owns private Recipe Dost data.
- The mobile RevenueCat SDK is configured with that authenticated Supabase UUID.
- Google Play/RevenueCat establishes purchase state.
- `user_profiles` is the backend entitlement projection used by `get-ai-access`
  and `create-media-job`.
- A purchase never proves ownership of recipes belonging to a different
  Supabase user, and M24.1 never transfers recipe or grocery ownership.

## Alias-aware binding

`sync-revenuecat-entitlement` always derives the current Supabase UUID from the
authenticated bearer token and queries RevenueCat using that UUID. A successful
RevenueCat response may resolve that UUID as an alias whose
`original_app_user_id` is different.

The function computes, server-side:

```text
HMAC-SHA-256(
  REVENUECAT_BINDING_HMAC_SECRET,
  environment + ":" + original_app_user_id
)
```

Only the HMAC customer key is stored. Raw RevenueCat original IDs and aliases are
not stored in the binding table or logs.

Binding rules:

1. No customer or user binding in the environment: bind them.
2. The same customer key is already bound to the same user: verify it.
3. The customer is bound to another user, the user is bound to another customer,
   or the binding is revoked: return `revenuecat_binding_conflict`.
4. Never automatically transfer entitlement or private data.

Development and production bindings are independent because `environment` is
part of both uniqueness constraints and the HMAC input.

## Runtime environment configuration

`RECIPE_DOST_ENV` is the server-only environment boundary. Its only accepted
normalized values are `development` and `production`; `SUPABASE_ENV_NAME` is not
read because custom names with the `SUPABASE_` prefix are reserved by Supabase.

The variable name is not part of the binding key. With
`RECIPE_DOST_ENV=development`, the HMAC message remains exactly:

```text
development + ":" + original_app_user_id
```

`sync-revenuecat-entitlement` validates environment, binding HMAC secret,
RevenueCat API key, entitlement identifier, and required Supabase server runtime
configuration inside its request path. Configuration failure occurs before the
lease or provider call, emits `subscription_sync_started` and
`subscription_sync_failed` with allowlisted names only, and returns a compatible
JSON error envelope. No config value, raw user ID, RevenueCat ID, bearer token,
or request URL is logged.

## Synchronization lease

`revenuecat_sync_state` has one row per environment and Supabase user. The
service-only `acquire_revenuecat_sync_lease` RPC atomically acquires a 20-second
lease only when no lease exists or the previous lease expired.

The lease owner makes the RevenueCat request. A concurrent caller receives HTTP
200 with all existing success fields populated from `user_profiles` plus:

```json
{
  "sync_status": "in_progress",
  "entitlement_source": "cached_projection",
  "freshness": "cached",
  "sync_result_code": "sync_in_progress"
}
```

Success and failure both attempt to release the lease and record result code and
latency bucket. A crashed invocation is recoverable when the bounded lease
expires.

## Provider transport and projection

- Timeout: eight seconds per attempt.
- Maximum attempts: two.
- Retry: transient network failure and HTTP 5xx only.
- No retry: RevenueCat 401/403, 404, 429, or invalid response.
- Returned errors contain stable codes and safe messages, never provider bodies
  or identifiers.

A valid active Premium entitlement writes active state and existing product,
expiry, and store columns. A valid absent/expired entitlement writes inactive
state; absence clears product/expiry/store metadata. Transient failures never
overwrite the cached projection.

## AI authorization

The shared access helper remains authoritative for both `get-ai-access` and
`create-media-job`. RevenueCat Premium requires:

```text
entitlement == "premium"
AND revenuecat_entitlement_active == true
AND (revenuecat_expires_at is null OR revenuecat_expires_at > now)
```

Null expiry is retained for legitimately non-expiring entitlements. Exact,
past, and invalid timestamps are inactive. Free 3-total, Premium 100-monthly,
tester/admin overrides, successful-job counting, and active reservations are
unchanged.

## Safe observability

Subscription logs contain only keyed user/customer hashes when keying inputs are
available, environment when valid, allowlisted trigger/configuration names,
configuration readiness, stage, status class, result, entitlement boolean,
freshness, latency bucket, and attempt count. Full UUIDs, RevenueCat IDs, aliases,
config values, request URLs, headers, receipts, tokens, and subscriber payloads
are prohibited.

## Recovery limitation

M24.1 repairs purchase synchronization, not anonymous data recovery. Reinstall
still creates a new anonymous Supabase user when no session remains. A future
mobile milestone must link the existing anonymous Supabase user in place to a
recoverable email/social identity before old private data can be restored.

## Mobile authoritative state machine (M24.3A)

The installed `react-native-purchases` version is 10.4.0. Its installed type
declarations support `addCustomerInfoUpdateListener`, explicit
`removeCustomerInfoUpdateListener`, `invalidateCustomerInfoCache`,
`getCustomerInfo`, and `restorePurchases`; no RevenueCat dependency upgrade is
needed for this milestone.

All mobile consumers use `['ai-access-state', authenticatedSupabaseUserId]`.
The cached `get-ai-access` payload is the authoritative Recipe Dost access
snapshot. RevenueCat `CustomerInfo` is independent store evidence and never
directly enables AI generation.

States are `initializing`, `free`, `premium_confirmed`,
`store_premium_backend_pending`, `expired`,
`restore_no_active_entitlement`, `refresh_failed_cached_premium`,
`refresh_failed_free`, and `binding_conflict`. `premium_confirmed` requires
backend `premiumActive=true`. Local-active/backend-Free is pending, not Premium.
Known backend Free or expiry replaces cached Premium; a transient provider/access
failure may show the still-cached Premium snapshot without claiming a successful
refresh.

The in-memory query cache is scoped by Supabase user and has a conservative
60-second stale time. It renders the last successful snapshot immediately.
Bootstrap and app foreground reconcile only when stale. SDK entitlement changes,
purchase, restore, explicit Refresh, and Generate recovery use the same keyed
Promise. Settings remount alone does not synchronize.

RevenueCat is configured once after Supabase authentication with the Supabase
UUID. An identity change uses `Purchases.logIn`. Exactly one customer-info
listener is registered after that identity is ready and removed on cleanup or
identity change. Explicit purchase/restore/refresh actions suppress the listener's
implicit chain, so each action performs one backend synchronization and one
authoritative access fetch.

Restore completion is not success. Active restored store evidence is synchronized
and success is shown only after backend Premium is confirmed. Current AI-job
eligibility is independent: `canStartAiJob=false` never downgrades a confirmed
subscription. Missing or expired evidence first reconciles the inactive
projection, then shows the corresponding no-active/expired state. A binding
conflict fails closed with support-oriented copy.

M24.3A-R keeps `backendPremiumActive` separate from
`backendCanStartAiJob`, `backendBlockReason`, `remainingToStart`,
`activeReserved`, `successfulUsed`, and `monthlyLimit`. Settings and paywall
therefore remain Premium while showing one of these generation states:

- remaining monthly recipes when generation can start;
- all monthly recipes used for `premium_monthly_limit_reached`;
- an AI recipe already processing when an active reservation blocks a start;
- safe temporary-unavailability copy for another normalized block.

Generate still requires authoritative `canStartAiJob=true`. Confirmed Premium
with a quota/reservation block cannot open the Free upgrade path, does not cause
RevenueCat reconciliation merely because it is blocked, and cannot create a job.

Safe analytics records only normalized state/trigger/expiry/environment/result
booleans and latency buckets. UUIDs, RevenueCat identifiers, receipts, tokens,
purchase payloads, and raw errors remain blocked.
