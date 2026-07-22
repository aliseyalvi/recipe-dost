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

Subscription logs contain only keyed user/customer hashes, environment,
allowlisted trigger, status class, result, entitlement boolean, freshness,
latency bucket, and attempt count. Full UUIDs, RevenueCat IDs, aliases, request
URLs, headers, receipts, tokens, and subscriber payloads are prohibited.

## Recovery limitation

M24.1 repairs purchase synchronization, not anonymous data recovery. Reinstall
still creates a new anonymous Supabase user when no session remains. A future
mobile milestone must link the existing anonymous Supabase user in place to a
recoverable email/social identity before old private data can be restored.
