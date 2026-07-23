import { hmacSha256Hex } from "../_shared/keyed-hash.ts";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SyncRevenueCatErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "subscription_sync_configuration_error"
  | "server_not_configured"
  | "revenuecat_not_configured"
  | "revenuecat_timeout"
  | "revenuecat_transient_failure"
  | "revenuecat_authentication_failed"
  | "revenuecat_subscriber_not_found"
  | "revenuecat_rate_limited"
  | "revenuecat_invalid_response"
  | "revenuecat_binding_conflict"
  | "sync_state_failed"
  | "profile_update_failed"
  | "unexpected_revenuecat_sync_error";

export type RevenueCatProjection = {
  revenuecat_entitlement_active: boolean;
  revenuecat_entitlement: string | null;
  revenuecat_product_id: string | null;
  revenuecat_expires_at: string | null;
  revenuecat_updated_at: string | null;
  revenuecat_store: string | null;
};

export type SyncSuccessData = RevenueCatProjection & {
  sync_status: "synchronized" | "in_progress";
  entitlement_source: "revenuecat_api" | "cached_projection";
  freshness: "fresh" | "cached";
  sync_result_code: string;
};

export type SyncServiceResult =
  | { ok: true; data: SyncSuccessData }
  | {
    ok: false;
    status: number;
    code: SyncRevenueCatErrorCode;
    message: string;
  };

export type LeaseResult = {
  acquired: boolean;
  lastResultCode: string | null;
};

export type BindingResult = "created" | "verified" | "conflict";

export type PersistedProjection = RevenueCatProjection & {
  revenuecat_updated_at: string;
};

export interface RevenueCatSyncStore {
  getProjection(userId: string): Promise<RevenueCatProjection | null>;
  acquireLease(
    environment: string,
    userId: string,
    leaseSeconds: number,
  ): Promise<LeaseResult>;
  bindCustomer(
    environment: string,
    customerKey: string,
    userId: string,
  ): Promise<BindingResult>;
  persistProjection(
    environment: string,
    customerKey: string,
    userId: string,
    projection: PersistedProjection,
  ): Promise<boolean>;
  completeLease(
    environment: string,
    userId: string,
    succeeded: boolean,
    resultCode: string,
    latencyBucket: string,
  ): Promise<boolean>;
}

export type SafeSubscriptionLog = {
  event:
    | "subscription_sync_started"
    | "subscription_sync_completed"
    | "subscription_sync_failed"
    | "subscription_sync_coalesced"
    | "revenuecat_binding_created"
    | "revenuecat_binding_verified"
    | "revenuecat_binding_conflict";
  supabase_user_hash?: string;
  revenuecat_customer_hash?: string;
  environment?: string;
  trigger: string;
  status_class: "2xx" | "4xx" | "5xx";
  sync_result: string;
  entitlement_active?: boolean;
  freshness: "fresh" | "cached" | "unchanged";
  latency_bucket: string;
  attempt_count: number;
  configuration_ready?: boolean;
  stage?: "configuration";
  normalized_error_code?: "subscription_sync_configuration_error";
  missing_config_names?: string[];
  invalid_config_names?: string[];
};

export type RevenueCatTransportResult =
  | { ok: true; data: Json; attempts: number }
  | {
    ok: false;
    code: SyncRevenueCatErrorCode;
    status: number;
    attempts: number;
  };

export type SyncServiceDependencies = {
  store: RevenueCatSyncStore;
  fetchSubscriber: () => Promise<RevenueCatTransportResult>;
  hmacSecret: string;
  log: (entry: SafeSubscriptionLog) => void;
  now?: () => number;
};

export async function synchronizeRevenueCatEntitlement(
  input: {
    environment: string;
    userId: string;
    entitlementId: string;
    trigger: string;
  },
  dependencies: SyncServiceDependencies,
): Promise<SyncServiceResult> {
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const userHash = await hmacSha256Hex(
    dependencies.hmacSecret,
    `user:${input.environment}:${input.userId}`,
  );
  let cachedProjection: RevenueCatProjection;

  try {
    cachedProjection = normalizeCachedProjection(
      await dependencies.store.getProjection(input.userId),
    );
  } catch {
    return syncError("profile_update_failed", 500);
  }

  let lease: LeaseResult;
  try {
    lease = await dependencies.store.acquireLease(
      input.environment,
      input.userId,
      20,
    );
  } catch {
    return syncError("sync_state_failed", 500);
  }

  if (!lease.acquired) {
    const latencyBucket = getLatencyBucket(now() - startedAt);
    dependencies.log({
      event: "subscription_sync_coalesced",
      supabase_user_hash: userHash,
      environment: input.environment,
      trigger: input.trigger,
      status_class: "2xx",
      sync_result: "sync_in_progress",
      entitlement_active: cachedProjection.revenuecat_entitlement_active,
      freshness: "cached",
      latency_bucket: latencyBucket,
      attempt_count: 0,
    });
    return {
      ok: true,
      data: {
        ...cachedProjection,
        sync_status: "in_progress",
        entitlement_source: "cached_projection",
        freshness: "cached",
        sync_result_code: "sync_in_progress",
      },
    };
  }

  let attempts = 0;
  let result: SyncServiceResult;
  let customerHash: string | undefined;

  try {
    const transport = await dependencies.fetchSubscriber();
    attempts = transport.attempts;

    if (!transport.ok) {
      result = syncError(transport.code, transport.status);
    } else {
      const subscriber = parseRevenueCatSubscriber(
        transport.data,
        input.entitlementId,
        now(),
      );

      if (!subscriber.ok) {
        result = syncError("revenuecat_invalid_response", 502);
      } else {
        customerHash = await hmacSha256Hex(
          dependencies.hmacSecret,
          `${input.environment}:${subscriber.originalAppUserId}`,
        );
        const binding = await dependencies.store.bindCustomer(
          input.environment,
          customerHash,
          input.userId,
        );

        if (binding === "conflict") {
          dependencies.log({
            event: "revenuecat_binding_conflict",
            supabase_user_hash: userHash,
            revenuecat_customer_hash: customerHash,
            environment: input.environment,
            trigger: input.trigger,
            status_class: "4xx",
            sync_result: "revenuecat_binding_conflict",
            freshness: "unchanged",
            latency_bucket: getLatencyBucket(now() - startedAt),
            attempt_count: attempts,
          });
          result = syncError("revenuecat_binding_conflict", 409);
        } else {
          dependencies.log({
            event: binding === "created"
              ? "revenuecat_binding_created"
              : "revenuecat_binding_verified",
            supabase_user_hash: userHash,
            revenuecat_customer_hash: customerHash,
            environment: input.environment,
            trigger: input.trigger,
            status_class: "2xx",
            sync_result: binding,
            freshness: "fresh",
            latency_bucket: getLatencyBucket(now() - startedAt),
            attempt_count: attempts,
          });

          const syncedAt = new Date(now()).toISOString();
          const projection: PersistedProjection = {
            ...subscriber.projection,
            revenuecat_updated_at: syncedAt,
          };
          let persisted = false;
          try {
            persisted = await dependencies.store.persistProjection(
              input.environment,
              customerHash,
              input.userId,
              projection,
            );
          } catch {
            persisted = false;
          }

          result = persisted
            ? {
              ok: true,
              data: {
                ...projection,
                sync_status: "synchronized",
                entitlement_source: "revenuecat_api",
                freshness: "fresh",
                sync_result_code: subscriber.projection
                    .revenuecat_entitlement_active
                  ? "premium_active"
                  : "premium_inactive",
              },
            }
            : syncError("profile_update_failed", 500);
        }
      }
    }
  } catch {
    result = syncError("unexpected_revenuecat_sync_error", 500);
  }

  const latencyBucket = getLatencyBucket(now() - startedAt);
  const resultCode = result.ok ? result.data.sync_result_code : result.code;
  const completed = await completeLeaseSafely(
    dependencies.store,
    input.environment,
    input.userId,
    result.ok,
    resultCode,
    latencyBucket,
  );

  if (!completed) {
    result = syncError("sync_state_failed", 500);
  }

  dependencies.log({
    event: result.ok
      ? "subscription_sync_completed"
      : "subscription_sync_failed",
    supabase_user_hash: userHash,
    revenuecat_customer_hash: customerHash,
    environment: input.environment,
    trigger: input.trigger,
    status_class: statusClass(result.ok ? 200 : result.status),
    sync_result: result.ok ? result.data.sync_result_code : result.code,
    entitlement_active: result.ok
      ? result.data.revenuecat_entitlement_active
      : cachedProjection.revenuecat_entitlement_active,
    freshness: result.ok ? "fresh" : "unchanged",
    latency_bucket: latencyBucket,
    attempt_count: attempts,
  });

  return result;
}

export async function fetchRevenueCatSubscriberWithRetry({
  apiKey,
  appUserId,
  fetchImpl = fetch,
  timeoutMs = 8_000,
  maxAttempts = 2,
  backoffMs = 150,
  sleep = defaultSleep,
}: {
  apiKey: string;
  appUserId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<RevenueCatTransportResult> {
  let lastTransientCode: SyncRevenueCatErrorCode =
    "revenuecat_transient_failure";
  let lastTransientStatus = 502;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(
        `https://api.revenuecat.com/v1/subscribers/${
          encodeURIComponent(appUserId)
        }`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        },
      );

      if (response.ok) {
        try {
          return {
            ok: true,
            data: await response.json() as Json,
            attempts: attempt,
          };
        } catch {
          return {
            ok: false,
            code: "revenuecat_invalid_response",
            status: 502,
            attempts: attempt,
          };
        }
      }

      if (response.status >= 500) {
        lastTransientCode = "revenuecat_transient_failure";
        lastTransientStatus = 502;
        if (attempt < maxAttempts) {
          await sleep(backoffMs * attempt);
          continue;
        }
        return {
          ok: false,
          code: lastTransientCode,
          status: lastTransientStatus,
          attempts: attempt,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          code: "revenuecat_authentication_failed",
          status: 502,
          attempts: attempt,
        };
      }
      if (response.status === 404) {
        return {
          ok: false,
          code: "revenuecat_subscriber_not_found",
          status: 404,
          attempts: attempt,
        };
      }
      if (response.status === 429) {
        return {
          ok: false,
          code: "revenuecat_rate_limited",
          status: 429,
          attempts: attempt,
        };
      }

      return {
        ok: false,
        code: "revenuecat_invalid_response",
        status: 502,
        attempts: attempt,
      };
    } catch (error) {
      const timedOut = controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      lastTransientCode = timedOut
        ? "revenuecat_timeout"
        : "revenuecat_transient_failure";
      lastTransientStatus = timedOut ? 504 : 503;

      if (attempt < maxAttempts) {
        await sleep(backoffMs * attempt);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    code: lastTransientCode,
    status: lastTransientStatus,
    attempts: maxAttempts,
  };
}

export function parseRevenueCatSubscriber(
  data: Json,
  entitlementId: string,
  nowMs: number,
):
  | {
    ok: true;
    originalAppUserId: string;
    projection: Omit<RevenueCatProjection, "revenuecat_updated_at">;
  }
  | { ok: false } {
  const subscriber = isRecord(data) && isRecord(data.subscriber)
    ? data.subscriber
    : null;
  const originalAppUserId = getString(subscriber?.original_app_user_id);

  if (!subscriber || !originalAppUserId || !isRecord(subscriber.entitlements)) {
    return { ok: false };
  }

  const hasEntitlement = Object.prototype.hasOwnProperty.call(
    subscriber.entitlements,
    entitlementId,
  );
  const rawEntitlement = subscriber.entitlements[entitlementId];

  if (hasEntitlement && !isRecord(rawEntitlement)) {
    return { ok: false };
  }

  const entitlement = hasEntitlement ? getRecord(rawEntitlement) : null;
  const productId = getOptionalString(entitlement?.product_identifier);
  const expiresAtValue = entitlement?.expires_date;
  if (
    expiresAtValue !== null && expiresAtValue !== undefined &&
    getString(expiresAtValue) === null
  ) {
    return { ok: false };
  }
  const expiresAt = getOptionalString(expiresAtValue);
  const expiresAtMs = expiresAt === null ? null : Date.parse(expiresAt);

  if (expiresAt !== null && !Number.isFinite(expiresAtMs)) {
    return { ok: false };
  }

  const active = entitlement !== null &&
    (expiresAtMs === null || expiresAtMs > nowMs);
  const subscriptions = isRecord(subscriber.subscriptions)
    ? subscriber.subscriptions
    : {};
  const subscription = productId ? getRecord(subscriptions[productId]) : null;

  return {
    ok: true,
    originalAppUserId,
    projection: {
      revenuecat_entitlement_active: active,
      revenuecat_entitlement: entitlement === null ? null : entitlementId,
      revenuecat_product_id: productId,
      revenuecat_expires_at: expiresAt,
      revenuecat_store: getOptionalString(subscription?.store),
    },
  };
}

export function getLatencyBucket(milliseconds: number) {
  if (milliseconds < 250) return "lt_250ms";
  if (milliseconds < 1_000) return "250_999ms";
  if (milliseconds < 3_000) return "1_3s";
  if (milliseconds < 8_000) return "3_8s";
  return "gte_8s";
}

export function normalizeTrigger(value: unknown) {
  const allowed = new Set([
    "bootstrap",
    "purchase",
    "restore",
    "settings_refresh",
    "settings_auto",
    "generate",
    "unknown",
  ]);
  return typeof value === "string" && allowed.has(value) ? value : "unknown";
}

export function parseSyncRequestBody(rawBody: string):
  | { ok: true; trigger: string }
  | { ok: false } {
  if (!rawBody.trim()) return { ok: true, trigger: "unknown" };

  try {
    const body = JSON.parse(rawBody) as unknown;
    if (!isRecord(body)) return { ok: false };
    if (Object.keys(body).some((key) => key !== "trigger")) {
      return { ok: false };
    }
    if (
      body.trigger !== undefined &&
      (typeof body.trigger !== "string" || body.trigger.length > 80)
    ) {
      return { ok: false };
    }
    return { ok: true, trigger: normalizeTrigger(body.trigger) };
  } catch {
    return { ok: false };
  }
}

function normalizeCachedProjection(
  projection: RevenueCatProjection | null,
): RevenueCatProjection {
  return projection ?? {
    revenuecat_entitlement_active: false,
    revenuecat_entitlement: null,
    revenuecat_product_id: null,
    revenuecat_expires_at: null,
    revenuecat_updated_at: null,
    revenuecat_store: null,
  };
}

function syncError(
  code: SyncRevenueCatErrorCode,
  status: number,
): SyncServiceResult {
  return {
    ok: false,
    status,
    code,
    message: code === "revenuecat_binding_conflict"
      ? "This purchase is already linked to another app profile."
      : "Could not sync Premium access. Please try again.",
  };
}

async function completeLeaseSafely(
  store: RevenueCatSyncStore,
  environment: string,
  userId: string,
  succeeded: boolean,
  resultCode: string,
  latencyBucket: string,
) {
  try {
    return await store.completeLease(
      environment,
      userId,
      succeeded,
      resultCode,
      latencyBucket,
    );
  } catch {
    return false;
  }
}

function statusClass(status: number): "2xx" | "4xx" | "5xx" {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  return "2xx";
}

function isRecord(value: unknown): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOptionalString(value: unknown) {
  return value === null || value === undefined ? null : getString(value);
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
