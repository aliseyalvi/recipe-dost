import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UserProfileUpsert = {
  user_id: string;
  revenuecat_app_user_id: string;
  revenuecat_entitlement: string | null;
  revenuecat_entitlement_active: boolean;
  revenuecat_updated_at: string;
  revenuecat_product_id?: string | null;
  revenuecat_expires_at?: string | null;
  revenuecat_store?: string | null;
};

type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: Record<string, unknown>;
        Insert: UserProfileUpsert;
        Update: Partial<UserProfileUpsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type EdgeSupabaseClient = SupabaseClient<Database>;

type SyncRevenueCatErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "server_not_configured"
  | "revenuecat_not_configured"
  | "revenuecat_api_failed"
  | "revenuecat_identity_mismatch"
  | "revenuecat_sync_uncertain"
  | "profile_update_failed"
  | "unexpected_revenuecat_sync_error";

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

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(
      "unauthorized",
      "Sign in to sync Premium access.",
      401,
    );
  }

  const revenueCatApiKey = Deno.env.get("REVENUECAT_API_KEY")?.trim();

  if (!revenueCatApiKey) {
    return errorResponse(
      "revenuecat_not_configured",
      "Premium sync is not configured yet.",
      503,
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

  const entitlementId =
    Deno.env.get("REVENUECAT_ENTITLEMENT_ID")?.trim() || "premium";
  const revenueCatResult = await fetchRevenueCatSubscriber(
    revenueCatApiKey,
    user.id,
  );

  if (!revenueCatResult.ok) {
    return errorResponse(
      "revenuecat_api_failed",
      "Could not sync Premium access. Please try again.",
      revenueCatResult.status,
    );
  }

  const existingProfile = await getExistingProfile(clients.adminClient, user.id);

  if (!existingProfile.ok) {
    return errorResponse(
      "profile_update_failed",
      "Could not sync Premium access. Please try again.",
      500,
    );
  }

  const existingPremiumActive =
    existingProfile.data?.revenuecat_entitlement_active === true;
  const existingAppUserId = getString(
    existingProfile.data?.revenuecat_app_user_id,
  );

  if (existingPremiumActive && existingAppUserId && existingAppUserId !== user.id) {
    return errorResponse(
      "revenuecat_identity_mismatch",
      "Could not sync Premium access. Please try again.",
      409,
    );
  }

  const entitlement = getRevenueCatEntitlement(
    revenueCatResult.data,
    entitlementId,
    user.id,
    existingPremiumActive,
  );

  if (!entitlement.ok) {
    return errorResponse(
      entitlement.code,
      "Could not sync Premium access. Please try again.",
      entitlement.status,
    );
  }

  const syncedAt = new Date().toISOString();
  const update = {
    user_id: user.id,
    revenuecat_app_user_id: user.id,
    revenuecat_entitlement: entitlement.data.entitlementId,
    revenuecat_entitlement_active: entitlement.data.active,
    revenuecat_updated_at: syncedAt,
    revenuecat_product_id: entitlement.data.productId,
    revenuecat_expires_at: entitlement.data.expiresAt,
    revenuecat_store: entitlement.data.store,
  } satisfies UserProfileUpsert;

  const updateResult = await clients.adminClient
    .from("user_profiles")
    .upsert(update, { onConflict: "user_id" });

  if (updateResult.error) {
    return errorResponse(
      "profile_update_failed",
      "Could not sync Premium access. Please try again.",
      500,
    );
  }

  return jsonResponse({
    ok: true,
    data: {
      revenuecat_entitlement_active: update.revenuecat_entitlement_active,
      revenuecat_entitlement: update.revenuecat_entitlement,
      revenuecat_product_id: update.revenuecat_product_id,
      revenuecat_expires_at: update.revenuecat_expires_at,
      revenuecat_updated_at: update.revenuecat_updated_at,
    },
  });
}

async function fetchRevenueCatSubscriber(
  apiKey: string,
  appUserId: string,
): Promise<
  | { ok: true; data: Json }
  | { ok: false; status: number }
> {
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    return { ok: false, status: response.status >= 500 ? 502 : response.status };
  }

  return { ok: true, data: await response.json() as Json };
}

function getRevenueCatEntitlement(
  data: Json,
  entitlementId: string,
  appUserId: string,
  existingPremiumActive: boolean,
) {
  const subscriber = isRecord(data) && isRecord(data.subscriber)
    ? data.subscriber
    : null;

  if (!subscriber) {
    return {
      ok: false,
      code: "revenuecat_sync_uncertain",
      status: 502,
    } as const;
  }

  const originalAppUserId = getString(subscriber.original_app_user_id);

  if (!originalAppUserId && existingPremiumActive) {
    return {
      ok: false,
      code: "revenuecat_identity_mismatch",
      status: 409,
    } as const;
  }

  if (originalAppUserId && originalAppUserId !== appUserId) {
    return {
      ok: false,
      code: "revenuecat_identity_mismatch",
      status: 409,
    } as const;
  }

  if (!isRecord(subscriber.entitlements)) {
    return {
      ok: false,
      code: "revenuecat_sync_uncertain",
      status: 502,
    } as const;
  }

  const entitlements = subscriber.entitlements;
  const entitlement = getRecord(entitlements[entitlementId]);

  if (!entitlement && existingPremiumActive) {
    return {
      ok: false,
      code: "revenuecat_sync_uncertain",
      status: 409,
    } as const;
  }

  const productId = getString(entitlement?.product_identifier);
  const expiresAt = getString(entitlement?.expires_date);
  const expiresAtTime = expiresAt ? new Date(expiresAt).getTime() : null;

  if (expiresAt && Number.isNaN(expiresAtTime)) {
    return {
      ok: false,
      code: "revenuecat_sync_uncertain",
      status: 502,
    } as const;
  }

  const active = Boolean(entitlement) &&
    (!expiresAtTime || expiresAtTime > Date.now());
  const subscriptions = subscriber && isRecord(subscriber.subscriptions)
    ? subscriber.subscriptions
    : {};
  const subscription = productId ? getRecord(subscriptions[productId]) : null;

  return {
    ok: true,
    data: {
      active,
      entitlementId: entitlement ? entitlementId : null,
      productId,
      expiresAt,
      store: getString(subscription?.store),
    },
  } as const;
}

async function getExistingProfile(
  client: EdgeSupabaseClient,
  userId: string,
): Promise<
  | {
    ok: true;
    data: {
      revenuecat_entitlement_active?: unknown;
      revenuecat_app_user_id?: unknown;
    } | null;
  }
  | { ok: false }
> {
  const result = await client
    .from("user_profiles")
    .select("revenuecat_entitlement_active,revenuecat_app_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) {
    return { ok: false };
  }

  return {
    ok: true,
    data: result.data,
  };
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

  return {
    userClient,
    adminClient,
  } satisfies {
    userClient: EdgeSupabaseClient;
    adminClient: EdgeSupabaseClient;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function errorResponse(
  code: SyncRevenueCatErrorCode,
  message: string,
  status: number,
) {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
      },
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
