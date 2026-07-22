import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  fetchRevenueCatSubscriberWithRetry,
  parseSyncRequestBody,
  type RevenueCatSyncStore,
  type SafeSubscriptionLog,
  synchronizeRevenueCatEntitlement,
  type SyncRevenueCatErrorCode,
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

Deno.serve((request) =>
  handleSyncRevenueCatEntitlementRequest(request).catch(() =>
    errorResponse(
      "unexpected_revenuecat_sync_error",
      "Could not sync Premium access. Please try again.",
      500,
    )
  )
);

async function handleSyncRevenueCatEntitlementRequest(request: Request) {
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

  const configuration = getConfiguration();
  if (!configuration.ok) {
    return errorResponse(
      configuration.code,
      "Premium sync is not configured yet.",
      configuration.status,
    );
  }

  const clients = createSupabaseClients(authHeader);
  if (!clients) {
    return errorResponse(
      "server_not_configured",
      "Premium sync is not configured yet.",
      500,
    );
  }

  const {
    data: { user },
    error: authError,
  } = await clients.userClient.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "unauthorized",
      "Sign in to sync Premium access.",
      401,
    );
  }

  const store = createSyncStore(clients.adminClient);
  const result = await synchronizeRevenueCatEntitlement(
    {
      environment: configuration.environment,
      userId: user.id,
      entitlementId: configuration.entitlementId,
      trigger: parsedInput.trigger,
    },
    {
      store,
      hmacSecret: configuration.hmacSecret,
      fetchSubscriber: () =>
        fetchRevenueCatSubscriberWithRetry({
          apiKey: configuration.revenueCatApiKey,
          appUserId: user.id,
        }),
      log: writeSafeSubscriptionLog,
    },
  );

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

function getConfiguration():
  | {
    ok: true;
    revenueCatApiKey: string;
    entitlementId: string;
    hmacSecret: string;
    environment: string;
  }
  | {
    ok: false;
    code: "revenuecat_not_configured" | "server_not_configured";
    status: number;
  } {
  const revenueCatApiKey = Deno.env.get("REVENUECAT_API_KEY")?.trim();
  const hmacSecret = Deno.env.get("REVENUECAT_BINDING_HMAC_SECRET")?.trim();
  const environment = Deno.env.get("SUPABASE_ENV_NAME")?.trim().toLowerCase();

  if (!revenueCatApiKey) {
    return { ok: false, code: "revenuecat_not_configured", status: 503 };
  }
  if (
    !hmacSecret || hmacSecret.length < 32 || !environment ||
    !/^[a-z0-9_-]{1,40}$/.test(environment)
  ) {
    return { ok: false, code: "server_not_configured", status: 500 };
  }

  return {
    ok: true,
    revenueCatApiKey,
    entitlementId: Deno.env.get("REVENUECAT_ENTITLEMENT_ID")?.trim() ||
      "premium",
    hmacSecret,
    environment,
  };
}

async function parseOptionalInput(request: Request): Promise<
  { ok: true; trigger: string } | { ok: false }
> {
  return parseSyncRequestBody(await request.text());
}

function createSupabaseClients(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !publishableKey || !serverKey) {
    return null;
  }

  const userClient = createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const adminClient = createClient<Database>(supabaseUrl, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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
