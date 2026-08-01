import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hmacSha256Hex } from "../_shared/keyed-hash.ts";
import {
  type EnvironmentReader,
  inspectSyncConfiguration,
  type SupabaseRuntimeConfiguration,
  type SyncConfigurationInspection,
  type SyncRuntimeConfiguration,
} from "./configuration.ts";
import {
  fetchRevenueCatSubscriberWithRetry,
  parseSyncRequestBody,
  type RevenueCatSyncStore,
  type SafeSubscriptionLog,
  synchronizeRevenueCatEntitlement,
  type SyncRevenueCatErrorCode,
  type SyncServiceResult,
} from "./service.ts";

type UserProfileRow = {
  user_id: string;
  revenuecat_entitlement_active: boolean | null;
  revenuecat_entitlement: string | null;
  revenuecat_product_id: string | null;
  revenuecat_expires_at: string | null;
  revenuecat_updated_at: string | null;
  revenuecat_store: string | null;
};

type LeaseRow = {
  lease_acquired: boolean;
  previous_last_result_code: string | null;
};

type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfileRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      acquire_revenuecat_sync_lease: {
        Args: {
          p_environment: string;
          p_supabase_user_id: string;
          p_lease_seconds: number;
        };
        Returns: LeaseRow[];
      };
      bind_revenuecat_customer: {
        Args: {
          p_environment: string;
          p_revenuecat_customer_key: string;
          p_supabase_user_id: string;
        };
        Returns: string;
      };
      persist_revenuecat_entitlement_projection: {
        Args: {
          p_environment: string;
          p_revenuecat_customer_key: string;
          p_supabase_user_id: string;
          p_entitlement: string | null;
          p_entitlement_active: boolean;
          p_product_id: string | null;
          p_expires_at: string | null;
          p_store: string | null;
          p_synced_at: string;
        };
        Returns: boolean;
      };
      complete_revenuecat_sync_lease: {
        Args: {
          p_environment: string;
          p_supabase_user_id: string;
          p_succeeded: boolean;
          p_result_code: string;
          p_latency_bucket: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type EdgeSupabaseClient = SupabaseClient<Database>;

type AuthenticatedSyncContext = {
  userId: string;
  adminClient: EdgeSupabaseClient;
};

type HandlerDependencies = {
  getEnvironment?: EnvironmentReader;
  log?: (entry: SafeSubscriptionLog) => void;
  authenticate?: (
    authHeader: string,
    configuration: SupabaseRuntimeConfiguration,
  ) => Promise<AuthenticatedSyncContext | null>;
  runSynchronization?: (input: {
    configuration: SyncRuntimeConfiguration;
    userId: string;
    trigger: string;
    adminClient: EdgeSupabaseClient;
  }) => Promise<SyncServiceResult>;
};

declare const Deno: {
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

if (import.meta.main) {
  Deno.serve((request) =>
    handleSyncRevenueCatEntitlementRequest(request).catch(() =>
      errorResponse(
        "unexpected_revenuecat_sync_error",
        "Could not sync Premium access. Please try again.",
        500,
      )
    )
  );
}

export async function handleSyncRevenueCatEntitlementRequest(
  request: Request,
  dependencies: HandlerDependencies = {},
) {
  const log = dependencies.log ?? writeSafeSubscriptionLog;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return errorResponse(
      "invalid_request",
      "Use POST to sync Premium access.",
      405,
    );
  }

  const parsedInput = await parseOptionalInput(request);
  if (!parsedInput.ok) {
    return errorResponse(
      "invalid_request",
      "Premium sync accepts only an optional trigger.",
      400,
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(
      "unauthorized",
      "Sign in to sync Premium access.",
      401,
    );
  }

  const configuration = inspectSyncConfiguration(
    dependencies.getEnvironment ?? ((name) => Deno.env.get(name)),
  );
  if (!configuration.supabaseConfiguration) {
    logConfigurationFailure(configuration, parsedInput.trigger, log);
    return configurationErrorResponse();
  }

  const authenticated = await (dependencies.authenticate ??
    authenticateWithSupabase)(authHeader, configuration.supabaseConfiguration);
  if (!authenticated) {
    return errorResponse(
      "unauthorized",
      "Sign in to sync Premium access.",
      401,
    );
  }

  const userHash = configuration.environment &&
      configuration.correlationHmacSecret
    ? await hmacSha256Hex(
      configuration.correlationHmacSecret,
      `user:${configuration.environment}:${authenticated.userId}`,
    )
    : undefined;

  log({
    event: "subscription_sync_started",
    supabase_user_hash: userHash,
    environment: configuration.environment,
    trigger: parsedInput.trigger,
    status_class: "2xx",
    sync_result: "started",
    freshness: "unchanged",
    latency_bucket: "lt_250ms",
    attempt_count: 0,
    configuration_ready: configuration.ok,
  });

  if (!configuration.ok || !configuration.configuration) {
    logConfigurationFailure(
      configuration,
      parsedInput.trigger,
      log,
      userHash,
      true,
    );
    return configurationErrorResponse();
  }

  const result = dependencies.runSynchronization
    ? await dependencies.runSynchronization({
      configuration: configuration.configuration,
      userId: authenticated.userId,
      trigger: parsedInput.trigger,
      adminClient: authenticated.adminClient,
    })
    : await runSynchronization({
      configuration: configuration.configuration,
      userId: authenticated.userId,
      trigger: parsedInput.trigger,
      adminClient: authenticated.adminClient,
      log,
    });

  if (!result.ok) {
    return errorResponse(result.code, result.message, result.status);
  }

  return jsonResponse({
    ok: true,
    data: {
      revenuecat_entitlement_active: result.data.revenuecat_entitlement_active,
      revenuecat_entitlement: result.data.revenuecat_entitlement,
      revenuecat_product_id: result.data.revenuecat_product_id,
      revenuecat_expires_at: result.data.revenuecat_expires_at,
      revenuecat_updated_at: result.data.revenuecat_updated_at,
      sync_status: result.data.sync_status,
      entitlement_source: result.data.entitlement_source,
      freshness: result.data.freshness,
      sync_result_code: result.data.sync_result_code,
    },
  });
}

async function runSynchronization({
  configuration,
  userId,
  trigger,
  adminClient,
  log,
}: {
  configuration: SyncRuntimeConfiguration;
  userId: string;
  trigger: string;
  adminClient: EdgeSupabaseClient;
  log: (entry: SafeSubscriptionLog) => void;
}) {
  return await synchronizeRevenueCatEntitlement(
    {
      environment: configuration.environment,
      userId,
      entitlementId: configuration.entitlementId,
      trigger,
    },
    {
      store: createSyncStore(adminClient),
      hmacSecret: configuration.hmacSecret,
      fetchSubscriber: () =>
        fetchRevenueCatSubscriberWithRetry({
          apiKey: configuration.revenueCatApiKey,
          appUserId: userId,
        }),
      log,
    },
  );
}

function logConfigurationFailure(
  configuration: SyncConfigurationInspection,
  trigger: string,
  log: (entry: SafeSubscriptionLog) => void,
  userHash?: string,
  startedAlready = false,
) {
  if (!startedAlready) {
    log({
      event: "subscription_sync_started",
      environment: configuration.environment,
      trigger,
      status_class: "2xx",
      sync_result: "started",
      freshness: "unchanged",
      latency_bucket: "lt_250ms",
      attempt_count: 0,
      configuration_ready: false,
    });
  }

  log({
    event: "subscription_sync_failed",
    supabase_user_hash: userHash,
    environment: configuration.environment,
    trigger,
    status_class: "5xx",
    sync_result: "subscription_sync_configuration_error",
    freshness: "unchanged",
    latency_bucket: "lt_250ms",
    attempt_count: 0,
    configuration_ready: false,
    stage: "configuration",
    normalized_error_code: "subscription_sync_configuration_error",
    missing_config_names: configuration.missingConfigNames,
    invalid_config_names: configuration.invalidConfigNames,
  });
}

function configurationErrorResponse() {
  return errorResponse(
    "subscription_sync_configuration_error",
    "Premium access synchronization is temporarily unavailable.",
    500,
  );
}

async function authenticateWithSupabase(
  authHeader: string,
  configuration: SupabaseRuntimeConfiguration,
): Promise<AuthenticatedSyncContext | null> {
  const clients = createSupabaseClients(authHeader, configuration);
  const {
    data: { user },
    error: authError,
  } = await clients.userClient.auth.getUser();

  return authError || !user
    ? null
    : { userId: user.id, adminClient: clients.adminClient };
}

function createSyncStore(client: EdgeSupabaseClient): RevenueCatSyncStore {
  return {
    async getProjection(userId) {
      const result = await client
        .from("user_profiles")
        .select(
          "revenuecat_entitlement_active,revenuecat_entitlement,revenuecat_product_id,revenuecat_expires_at,revenuecat_updated_at,revenuecat_store",
        )
        .eq("user_id", userId)
        .maybeSingle<UserProfileRow>();

      if (result.error) throw result.error;
      if (!result.data) return null;

      return {
        revenuecat_entitlement_active:
          result.data.revenuecat_entitlement_active === true,
        revenuecat_entitlement: result.data.revenuecat_entitlement,
        revenuecat_product_id: result.data.revenuecat_product_id,
        revenuecat_expires_at: result.data.revenuecat_expires_at,
        revenuecat_updated_at: result.data.revenuecat_updated_at,
        revenuecat_store: result.data.revenuecat_store,
      };
    },

    async acquireLease(environment, userId, leaseSeconds) {
      const result = await client.rpc("acquire_revenuecat_sync_lease", {
        p_environment: environment,
        p_supabase_user_id: userId,
        p_lease_seconds: leaseSeconds,
      }).single<LeaseRow>();

      if (result.error || !result.data) {
        throw result.error ?? new Error("sync state unavailable");
      }

      return {
        acquired: result.data.lease_acquired,
        lastResultCode: result.data.previous_last_result_code,
      };
    },

    async bindCustomer(environment, customerKey, userId) {
      const result = await client.rpc("bind_revenuecat_customer", {
        p_environment: environment,
        p_revenuecat_customer_key: customerKey,
        p_supabase_user_id: userId,
      });

      if (result.error) throw result.error;
      if (
        result.data !== "created" && result.data !== "verified" &&
        result.data !== "conflict"
      ) {
        throw new Error("invalid binding result");
      }
      return result.data;
    },

    async persistProjection(environment, customerKey, userId, projection) {
      const result = await client.rpc(
        "persist_revenuecat_entitlement_projection",
        {
          p_environment: environment,
          p_revenuecat_customer_key: customerKey,
          p_supabase_user_id: userId,
          p_entitlement: projection.revenuecat_entitlement,
          p_entitlement_active: projection.revenuecat_entitlement_active,
          p_product_id: projection.revenuecat_product_id,
          p_expires_at: projection.revenuecat_expires_at,
          p_store: projection.revenuecat_store,
          p_synced_at: projection.revenuecat_updated_at,
        },
      );

      if (result.error) throw result.error;
      return result.data === true;
    },

    async completeLease(
      environment,
      userId,
      succeeded,
      resultCode,
      latencyBucket,
    ) {
      const result = await client.rpc("complete_revenuecat_sync_lease", {
        p_environment: environment,
        p_supabase_user_id: userId,
        p_succeeded: succeeded,
        p_result_code: resultCode,
        p_latency_bucket: latencyBucket,
      });

      if (result.error) throw result.error;
      return result.data === true;
    },
  };
}

async function parseOptionalInput(request: Request): Promise<
  { ok: true; trigger: string } | { ok: false }
> {
  return parseSyncRequestBody(await request.text());
}

function createSupabaseClients(
  authHeader: string,
  configuration: SupabaseRuntimeConfiguration,
) {
  const userClient = createClient<Database>(
    configuration.supabaseUrl,
    configuration.supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  );
  const adminClient = createClient<Database>(
    configuration.supabaseUrl,
    configuration.supabaseServerKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return { userClient, adminClient };
}

function writeSafeSubscriptionLog(entry: SafeSubscriptionLog) {
  console.log(JSON.stringify(entry));
}

function errorResponse(
  code: SyncRevenueCatErrorCode,
  message: string,
  status: number,
) {
  return jsonResponse(
    {
      ok: false,
      error: { code, message },
    },
    status,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
