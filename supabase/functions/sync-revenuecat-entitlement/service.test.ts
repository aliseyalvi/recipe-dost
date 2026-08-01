import assert from "node:assert/strict";
import { hmacSha256Hex } from "../_shared/keyed-hash.ts";
import {
  fetchRevenueCatSubscriberWithRetry,
  type Json,
  parseRevenueCatSubscriber,
  parseSyncRequestBody,
  type PersistedProjection,
  type RevenueCatProjection,
  type RevenueCatSyncStore,
  type RevenueCatTransportResult,
  type SafeSubscriptionLog,
  synchronizeRevenueCatEntitlement,
} from "./service.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const HMAC_SECRET = "m24-test-secret-with-at-least-32-characters";
const NOW = Date.parse("2026-07-22T12:00:00.000Z");

class FakeStore implements RevenueCatSyncStore {
  projection: RevenueCatProjection | null = null;
  leaseAcquired = true;
  bindingResult: "created" | "verified" | "conflict" = "created";
  persistResult = true;
  completeResult = true;
  acquireCalls = 0;
  bindCalls = 0;
  persistCalls = 0;
  completeCalls = 0;
  persistedProjection: PersistedProjection | null = null;
  persistedCustomerKey: string | null = null;

  getProjection() {
    return Promise.resolve(this.projection);
  }

  acquireLease() {
    this.acquireCalls += 1;
    return Promise.resolve({
      acquired: this.leaseAcquired,
      lastResultCode: null,
    });
  }

  bindCustomer(
    _environment: string,
    customerKey: string,
    _userId: string,
  ) {
    this.bindCalls += 1;
    this.persistedCustomerKey = customerKey;
    return Promise.resolve(this.bindingResult);
  }

  persistProjection(
    _environment: string,
    customerKey: string,
    _userId: string,
    projection: PersistedProjection,
  ) {
    this.persistCalls += 1;
    this.persistedCustomerKey = customerKey;
    this.persistedProjection = projection;
    return Promise.resolve(this.persistResult);
  }

  completeLease() {
    this.completeCalls += 1;
    return Promise.resolve(this.completeResult);
  }
}

function activeSubscriber(originalAppUserId = USER_A): Json {
  return {
    subscriber: {
      original_app_user_id: originalAppUserId,
      entitlements: {
        premium: {
          product_identifier: "premium_monthly",
          expires_date: "2026-08-22T12:00:00.000Z",
        },
      },
      subscriptions: {
        premium_monthly: { store: "play_store" },
      },
    },
  };
}

function absentEntitlementSubscriber(originalAppUserId = USER_A): Json {
  return {
    subscriber: {
      original_app_user_id: originalAppUserId,
      entitlements: {},
      subscriptions: {},
    },
  };
}

async function runSync({
  store = new FakeStore(),
  originalAppUserId = USER_A,
  transport,
  environment = "development",
}: {
  store?: FakeStore;
  originalAppUserId?: string;
  transport?: RevenueCatTransportResult;
  environment?: string;
} = {}) {
  const logs: SafeSubscriptionLog[] = [];
  let fetchCalls = 0;
  const result = await synchronizeRevenueCatEntitlement(
    {
      environment,
      userId: USER_A,
      entitlementId: "premium",
      trigger: "unknown",
    },
    {
      store,
      hmacSecret: HMAC_SECRET,
      now: () => NOW,
      log: (entry) => logs.push(entry),
      fetchSubscriber: () => {
        fetchCalls += 1;
        return Promise.resolve(
          transport ?? {
            ok: true,
            data: activeSubscriber(originalAppUserId),
            attempts: 1,
          },
        );
      },
    },
  );
  return { fetchCalls, logs, result, store };
}

Deno.test("same original ID creates a binding and active projection", async () => {
  const { result, store, logs } = await runSync();
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.data.revenuecat_entitlement_active, true);
  assert.equal(store.bindCalls, 1);
  assert.equal(store.persistCalls, 1);
  assert.equal(store.completeCalls, 1);
  assert.equal(
    store.persistedProjection?.revenuecat_product_id,
    "premium_monthly",
  );
  assert.ok(logs.some((entry) => entry.event === "revenuecat_binding_created"));
});

Deno.test("resolved alias succeeds when original ID differs from Supabase UUID", async () => {
  const { result, store } = await runSync({
    originalAppUserId: "legacy-revenuecat-anonymous-id",
  });
  assert.equal(result.ok, true);
  assert.equal(store.persistCalls, 1);
  assert.notEqual(store.persistedCustomerKey, USER_A);
  assert.equal(store.persistedCustomerKey?.length, 64);
});

Deno.test("existing same binding verifies successfully", async () => {
  const store = new FakeStore();
  store.bindingResult = "verified";
  const { result, logs } = await runSync({ store });
  assert.equal(result.ok, true);
  assert.ok(
    logs.some((entry) => entry.event === "revenuecat_binding_verified"),
  );
});

Deno.test("binding owned by another user conflicts without profile write", async () => {
  const store = new FakeStore();
  store.bindingResult = "conflict";
  const { result, logs } = await runSync({ store });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "revenuecat_binding_conflict");
  assert.equal(store.persistCalls, 0);
  assert.equal(store.completeCalls, 1);
  assert.ok(
    logs.some((entry) => entry.event === "revenuecat_binding_conflict"),
  );
});

Deno.test("environment is included in the keyed customer binding", async () => {
  const dev = await hmacSha256Hex(HMAC_SECRET, "development:original-id");
  const prod = await hmacSha256Hex(HMAC_SECRET, "production:original-id");
  assert.notEqual(dev, prod);

  const { store } = await runSync({ originalAppUserId: "original-id" });
  assert.equal(store.persistedCustomerKey, dev);
});

Deno.test("request body accepts no body or trigger and rejects user spoofing", () => {
  assert.deepEqual(parseSyncRequestBody(""), { ok: true, trigger: "unknown" });
  assert.deepEqual(parseSyncRequestBody("{}"), {
    ok: true,
    trigger: "unknown",
  });
  assert.deepEqual(parseSyncRequestBody('{"trigger":"restore"}'), {
    ok: true,
    trigger: "restore",
  });
  assert.deepEqual(parseSyncRequestBody(`{"supabase_user_id":"${USER_B}"}`), {
    ok: false,
  });
  assert.deepEqual(parseSyncRequestBody(`{"target_user_id":"${USER_B}"}`), {
    ok: false,
  });
});

Deno.test("concurrent caller is coalesced onto cached projection", async () => {
  const store = new FakeStore();
  store.leaseAcquired = false;
  store.projection = {
    revenuecat_entitlement_active: true,
    revenuecat_entitlement: "premium",
    revenuecat_product_id: "premium_monthly",
    revenuecat_expires_at: "2026-08-22T12:00:00.000Z",
    revenuecat_updated_at: "2026-07-22T11:59:00.000Z",
    revenuecat_store: "play_store",
  };
  const { fetchCalls, result, logs } = await runSync({ store });
  assert.equal(fetchCalls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.data.sync_status, "in_progress");
  assert.equal(
    result.ok && result.data.entitlement_source,
    "cached_projection",
  );
  assert.equal(result.ok && result.data.revenuecat_entitlement_active, true);
  assert.equal(store.completeCalls, 0);
  assert.ok(
    logs.some((entry) => entry.event === "subscription_sync_coalesced"),
  );
});

Deno.test("lease is completed after provider failure", async () => {
  const { result, store } = await runSync({
    transport: {
      ok: false,
      code: "revenuecat_transient_failure",
      status: 502,
      attempts: 2,
    },
  });
  assert.equal(result.ok, false);
  assert.equal(store.completeCalls, 1);
  assert.equal(store.persistCalls, 0);
});

Deno.test("missing entitlement clears stale Premium projection", async () => {
  const store = new FakeStore();
  store.projection = {
    revenuecat_entitlement_active: true,
    revenuecat_entitlement: "premium",
    revenuecat_product_id: "old_product",
    revenuecat_expires_at: null,
    revenuecat_updated_at: "2026-07-01T00:00:00.000Z",
    revenuecat_store: "play_store",
  };
  const { result } = await runSync({
    store,
    transport: {
      ok: true,
      data: absentEntitlementSubscriber(),
      attempts: 1,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.data.revenuecat_entitlement_active, false);
  assert.equal(store.persistedProjection?.revenuecat_entitlement, null);
  assert.equal(store.persistedProjection?.revenuecat_product_id, null);
  assert.equal(store.persistedProjection?.revenuecat_expires_at, null);
});

Deno.test("transient provider failure preserves cached projection", async () => {
  const store = new FakeStore();
  store.projection = {
    revenuecat_entitlement_active: true,
    revenuecat_entitlement: "premium",
    revenuecat_product_id: "premium_monthly",
    revenuecat_expires_at: null,
    revenuecat_updated_at: "2026-07-01T00:00:00.000Z",
    revenuecat_store: "play_store",
  };
  const { result } = await runSync({
    store,
    transport: {
      ok: false,
      code: "revenuecat_transient_failure",
      status: 502,
      attempts: 2,
    },
  });
  assert.equal(result.ok, false);
  assert.equal(store.persistCalls, 0);
  assert.equal(store.projection?.revenuecat_entitlement_active, true);
});

Deno.test("profile persistence failure returns typed error", async () => {
  const store = new FakeStore();
  store.persistResult = false;
  const { result } = await runSync({ store });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "profile_update_failed");
});

Deno.test("transport retries one 5xx then succeeds", async () => {
  let calls = 0;
  const result = await fetchRevenueCatSubscriberWithRetry({
    apiKey: "server-key",
    appUserId: USER_A,
    backoffMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: (() => {
      calls += 1;
      return Promise.resolve(
        calls === 1
          ? new Response(null, { status: 503 })
          : Response.json(activeSubscriber()),
      );
    }) as typeof fetch,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
});

Deno.test("transport returns typed error after repeated 5xx", async () => {
  const result = await fetchRevenueCatSubscriberWithRetry({
    apiKey: "server-key",
    appUserId: USER_A,
    backoffMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: (() =>
      Promise.resolve(new Response(null, { status: 500 }))) as typeof fetch,
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "revenuecat_transient_failure");
  assert.equal(result.attempts, 2);
});

Deno.test("transport does not retry RevenueCat 401 or 403", async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    const result = await fetchRevenueCatSubscriberWithRetry({
      apiKey: "server-key",
      appUserId: USER_A,
      fetchImpl: (() => {
        calls += 1;
        return Promise.resolve(new Response(null, { status }));
      }) as typeof fetch,
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, "revenuecat_authentication_failed");
    assert.equal(calls, 1);
  }
});

Deno.test("transport normalizes rate limits without retry", async () => {
  let calls = 0;
  const result = await fetchRevenueCatSubscriberWithRetry({
    apiKey: "server-key",
    appUserId: USER_A,
    fetchImpl: (() => {
      calls += 1;
      return Promise.resolve(new Response(null, { status: 429 }));
    }) as typeof fetch,
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "revenuecat_rate_limited");
  assert.equal(calls, 1);
});

Deno.test("transport times out with two bounded attempts", async () => {
  const result = await fetchRevenueCatSubscriberWithRetry({
    apiKey: "server-key",
    appUserId: USER_A,
    timeoutMs: 2,
    backoffMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: ((_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")));
      })) as typeof fetch,
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "revenuecat_timeout");
  assert.equal(result.attempts, 2);
});

Deno.test("transport rejects invalid JSON without exposing IDs", async () => {
  const result = await fetchRevenueCatSubscriberWithRetry({
    apiKey: "server-key",
    appUserId: USER_A,
    fetchImpl: (() =>
      Promise.resolve(
        new Response("not-json", { status: 200 }),
      )) as typeof fetch,
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "revenuecat_invalid_response");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(USER_A));
  assert.doesNotMatch(JSON.stringify(result), /server-key/);
});

Deno.test("subscriber parser requires structure and accepts inactive expiry", () => {
  assert.deepEqual(parseRevenueCatSubscriber({}, "premium", NOW), {
    ok: false,
  });
  const parsed = parseRevenueCatSubscriber(
    {
      subscriber: {
        original_app_user_id: "legacy-id",
        entitlements: {
          premium: {
            product_identifier: "premium_monthly",
            expires_date: "2026-07-22T12:00:00.000Z",
          },
        },
        subscriptions: {},
      },
    },
    "premium",
    NOW,
  );
  assert.equal(parsed.ok, true);
  assert.equal(
    parsed.ok && parsed.projection.revenuecat_entitlement_active,
    false,
  );
});
