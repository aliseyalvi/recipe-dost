import assert from "node:assert/strict";
import {
  inspectSyncConfiguration,
  type SyncRuntimeConfiguration,
} from "./configuration.ts";
import { handleSyncRevenueCatEntitlementRequest } from "./index.ts";
import type { SafeSubscriptionLog } from "./service.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const HMAC_SECRET = "m24d-test-secret-with-at-least-32-characters";

function validEnvironment(
  environment: "development" | "production" = "development",
) {
  return new Map<string, string>([
    ["RECIPE_DOST_ENV", environment],
    ["REVENUECAT_BINDING_HMAC_SECRET", HMAC_SECRET],
    ["REVENUECAT_API_KEY", "private-provider-key"],
    ["REVENUECAT_ENTITLEMENT_ID", "premium"],
    ["SUPABASE_URL", "https://example.supabase.co"],
    ["SUPABASE_ANON_KEY", "publishable-key"],
    ["SUPABASE_SERVICE_ROLE_KEY", "server-key"],
  ]);
}

function inspect(values: Map<string, string>) {
  return inspectSyncConfiguration((name) => values.get(name));
}

Deno.test("RECIPE_DOST_ENV accepts only normalized development and production", () => {
  const development = inspect(validEnvironment("development"));
  const productionValues = validEnvironment("production");
  productionValues.set("RECIPE_DOST_ENV", " PRODUCTION ");
  const production = inspect(productionValues);

  assert.equal(development.ok, true);
  assert.equal(development.configuration?.environment, "development");
  assert.equal(production.ok, true);
  assert.equal(production.configuration?.environment, "production");
});

Deno.test("missing or invalid RECIPE_DOST_ENV is a typed configuration finding", () => {
  const missingValues = validEnvironment();
  missingValues.delete("RECIPE_DOST_ENV");
  const invalidValues = validEnvironment();
  invalidValues.set("RECIPE_DOST_ENV", "staging");

  const missing = inspect(missingValues);
  const invalid = inspect(invalidValues);
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.missingConfigNames, ["RECIPE_DOST_ENV"]);
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.invalidConfigNames, ["RECIPE_DOST_ENV"]);
});

Deno.test("SUPABASE_ENV_NAME alone is not a deployed environment source", () => {
  const values = validEnvironment();
  values.delete("RECIPE_DOST_ENV");
  values.set("SUPABASE_ENV_NAME", "development");

  const result = inspect(values);
  assert.equal(result.ok, false);
  assert.ok(result.missingConfigNames.includes("RECIPE_DOST_ENV"));
  assert.equal(result.environment, undefined);
});

Deno.test("missing and short binding HMAC secrets are rejected", () => {
  const missingValues = validEnvironment();
  missingValues.delete("REVENUECAT_BINDING_HMAC_SECRET");
  const shortValues = validEnvironment();
  shortValues.set("REVENUECAT_BINDING_HMAC_SECRET", "too-short");

  const missing = inspect(missingValues);
  const short = inspect(shortValues);
  assert.ok(
    missing.missingConfigNames.includes("REVENUECAT_BINDING_HMAC_SECRET"),
  );
  assert.ok(
    short.invalidConfigNames.includes("REVENUECAT_BINDING_HMAC_SECRET"),
  );
  assert.equal(missing.correlationHmacSecret, undefined);
  assert.equal(short.correlationHmacSecret, undefined);
});

Deno.test("missing configuration returns a safe typed response before sync", async () => {
  const values = validEnvironment();
  values.delete("RECIPE_DOST_ENV");
  const logs: SafeSubscriptionLog[] = [];
  let synchronizationCalls = 0;
  const response = await handleSyncRevenueCatEntitlementRequest(
    new Request(
      "https://example.test/functions/v1/sync-revenuecat-entitlement",
      {
        method: "POST",
        headers: { Authorization: "Bearer redacted-test-token" },
      },
    ),
    {
      getEnvironment: (name) => values.get(name),
      authenticate: () =>
        Promise.resolve({ userId: USER_ID, adminClient: null as never }),
      log: (entry) => logs.push(entry),
      runSynchronization: () => {
        synchronizationCalls += 1;
        throw new Error("must not run");
      },
    },
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    ok: false,
    error: {
      code: "subscription_sync_configuration_error",
      message: "Premium access synchronization is temporarily unavailable.",
    },
  });
  assert.equal(synchronizationCalls, 0);
  assert.deepEqual(logs.map((entry) => entry.event), [
    "subscription_sync_started",
    "subscription_sync_failed",
  ]);
  assert.equal(logs[0]?.configuration_ready, false);
  assert.equal(logs[1]?.stage, "configuration");
  assert.deepEqual(logs[1]?.missing_config_names, ["RECIPE_DOST_ENV"]);
  const serialized = JSON.stringify({ body, logs });
  assert.equal(serialized.includes(USER_ID), false);
  assert.equal(serialized.includes(HMAC_SECRET), false);
  assert.equal(serialized.includes("redacted-test-token"), false);
});

Deno.test("invalid environment and missing or short HMAC return typed errors", async () => {
  const cases: Array<[string, (values: Map<string, string>) => void]> = [
    ["invalid environment", (values) => values.set("RECIPE_DOST_ENV", "qa")],
    [
      "missing HMAC",
      (values) => values.delete("REVENUECAT_BINDING_HMAC_SECRET"),
    ],
    [
      "short HMAC",
      (values) => values.set("REVENUECAT_BINDING_HMAC_SECRET", "short"),
    ],
  ];

  for (const [label, mutate] of cases) {
    const values = validEnvironment();
    mutate(values);
    let synchronizationCalls = 0;
    const response = await handleSyncRevenueCatEntitlementRequest(
      new Request(
        "https://example.test/functions/v1/sync-revenuecat-entitlement",
        {
          method: "POST",
          headers: { Authorization: "Bearer redacted-test-token" },
        },
      ),
      {
        getEnvironment: (name) => values.get(name),
        authenticate: () =>
          Promise.resolve({ userId: USER_ID, adminClient: null as never }),
        log: () => undefined,
        runSynchronization: () => {
          synchronizationCalls += 1;
          throw new Error("must not run");
        },
      },
    );
    const body = await response.json();
    assert.equal(response.status, 500, label);
    assert.equal(
      body.error.code,
      "subscription_sync_configuration_error",
      label,
    );
    assert.equal(synchronizationCalls, 0, label);
  }
});

Deno.test("valid no-body invocation proceeds to the synchronization lease boundary", async () => {
  const values = validEnvironment();
  const logs: SafeSubscriptionLog[] = [];
  let synchronizationCalls = 0;
  let receivedConfiguration: SyncRuntimeConfiguration | undefined;
  const response = await handleSyncRevenueCatEntitlementRequest(
    new Request(
      "https://example.test/functions/v1/sync-revenuecat-entitlement",
      {
        method: "POST",
        headers: { Authorization: "Bearer redacted-test-token" },
      },
    ),
    {
      getEnvironment: (name) => values.get(name),
      authenticate: () =>
        Promise.resolve({ userId: USER_ID, adminClient: null as never }),
      log: (entry) => logs.push(entry),
      runSynchronization: ({ configuration }) => {
        synchronizationCalls += 1;
        receivedConfiguration = configuration;
        return Promise.resolve({
          ok: true,
          data: {
            revenuecat_entitlement_active: true,
            revenuecat_entitlement: "premium",
            revenuecat_product_id: "premium_monthly",
            revenuecat_expires_at: "2026-08-22T12:00:00.000Z",
            revenuecat_updated_at: "2026-07-22T12:00:00.000Z",
            revenuecat_store: "play_store",
            sync_status: "synchronized",
            entitlement_source: "revenuecat_api",
            freshness: "fresh",
            sync_result_code: "premium_active",
          },
        });
      },
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(synchronizationCalls, 1);
  assert.equal(receivedConfiguration?.environment, "development");
  assert.equal(logs[0]?.event, "subscription_sync_started");
  assert.equal(logs[0]?.configuration_ready, true);
  assert.notEqual(logs[0]?.supabase_user_hash, USER_ID);
});
