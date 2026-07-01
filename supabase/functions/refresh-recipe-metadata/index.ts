import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type RecipePlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "other";

type MetadataStatus = "pending" | "completed" | "partial" | "failed";

type RecipeItem = {
  id: string;
  user_id: string;
  source_url: string;
  platform: string | null;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  metadata_status: string | null;
  source_metadata: Json;
  created_at: string;
  updated_at: string;
};

type RecipeItemUpdate = {
  platform?: RecipePlatform;
  title?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  metadata_status?: MetadataStatus;
  source_metadata?: Json;
};

type Database = {
  public: {
    Tables: {
      recipe_items: {
        Row: RecipeItem;
        Insert: never;
        Update: RecipeItemUpdate;
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

type RefreshRecipeMetadataErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "recipe_not_found"
  | "server_not_configured"
  | "metadata_refresh_failed"
  | "unexpected_metadata_refresh_error";

type PreviewMetadata = {
  platform: RecipePlatform | null;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  authorUsername: string | null;
  durationSeconds: number | null;
  resolver: string | null;
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

Deno.serve((request) =>
  handleRefreshRecipeMetadataRequest(request).catch(() =>
    errorResponse(
      "unexpected_metadata_refresh_error",
      "Could not refresh recipe metadata. Please try again.",
      500,
    )
  )
);

async function handleRefreshRecipeMetadataRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return errorResponse(
      "invalid_request",
      "Use POST to refresh recipe metadata.",
      405,
    );
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(
      "unauthorized",
      "Sign in to refresh recipe metadata.",
      401,
    );
  }

  const clients = createSupabaseClients(authHeader);

  if (!clients) {
    return errorResponse(
      "server_not_configured",
      "Metadata refresh is not configured yet.",
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
      "Sign in to refresh recipe metadata.",
      401,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "invalid_request",
      "Send a valid saved recipe ID.",
      400,
    );
  }

  const recipeItemId = getRecipeItemId(body);

  if (!recipeItemId) {
    return errorResponse(
      "invalid_request",
      "Send a valid saved recipe ID.",
      400,
    );
  }

  const recipeResult = await clients.userClient
    .from("recipe_items")
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, metadata_status, source_metadata, created_at, updated_at",
    )
    .eq("id", recipeItemId)
    .eq("user_id", user.id)
    .maybeSingle<RecipeItem>();

  if (recipeResult.error || !recipeResult.data) {
    return errorResponse(
      "recipe_not_found",
      "Saved recipe link not found.",
      404,
    );
  }

  const recipeItem = recipeResult.data;
  const workerConfig = getWorkerConfig();

  if (!workerConfig) {
    const failedItem = await markMetadataFailed(
      clients.adminClient,
      recipeItem,
    );

    return metadataErrorResponse(
      failedItem,
      "server_not_configured",
      "Metadata preview is not configured yet.",
    );
  }

  const previewResult = await fetchWorkerMetadataPreview({
    sourceUrl: recipeItem.source_url,
    platform: normalizePlatform(recipeItem.platform) ??
      detectPlatformFromUrl(recipeItem.source_url),
    workerUrl: workerConfig.workerUrl,
    workerSecret: workerConfig.workerSecret,
    timeoutMs: getMetadataPreviewTimeoutMs(),
  });

  if (!previewResult.ok) {
    const failedItem = await markMetadataFailed(
      clients.adminClient,
      recipeItem,
    );

    return metadataErrorResponse(
      failedItem,
      previewResult.code,
      previewResult.message,
    );
  }

  const safeMetadata = buildSafeSourceMetadata(
    recipeItem.source_url,
    previewResult.metadata,
  );
  const nextPlatform = previewResult.metadata.platform ??
    normalizePlatform(recipeItem.platform) ??
    detectPlatformFromUrl(recipeItem.source_url);
  const nextStatus = getMetadataStatus(previewResult.metadata);
  const updateResult = await clients.adminClient
    .from("recipe_items")
    .update({
      platform: nextPlatform,
      title: previewResult.metadata.title ?? recipeItem.title,
      thumbnail_url: previewResult.metadata.thumbnailUrl,
      duration_seconds: previewResult.metadata.durationSeconds,
      metadata_status: nextStatus,
      source_metadata: safeMetadata,
    })
    .eq("id", recipeItem.id)
    .eq("user_id", user.id)
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, metadata_status, source_metadata, created_at, updated_at",
    )
    .single<RecipeItem>();

  if (updateResult.error || !updateResult.data) {
    const failedItem = await markMetadataFailed(
      clients.adminClient,
      recipeItem,
    );

    return metadataErrorResponse(
      failedItem,
      "metadata_refresh_failed",
      "Could not update recipe metadata.",
    );
  }

  return jsonResponse({
    ok: true,
    data: {
      recipe_item: updateResult.data,
      metadata_status: nextStatus,
    },
  });
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

function getWorkerConfig() {
  const workerUrl = Deno.env.get("MEDIA_WORKER_URL")?.trim();
  const workerSecret = Deno.env.get("WORKER_API_SECRET")?.trim() ??
    Deno.env.get("MEDIA_WORKER_SECRET")?.trim();

  if (!workerUrl || !workerSecret) {
    return null;
  }

  return {
    workerUrl,
    workerSecret,
  };
}

async function fetchWorkerMetadataPreview({
  sourceUrl,
  platform,
  workerUrl,
  workerSecret,
  timeoutMs,
}: {
  sourceUrl: string;
  platform: RecipePlatform;
  workerUrl: string;
  workerSecret: string;
  timeoutMs: number;
}): Promise<
  | { ok: true; metadata: PreviewMetadata }
  | {
    ok: false;
    code: RefreshRecipeMetadataErrorCode;
    message: string;
  }
> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/metadata-preview`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
        "X-Worker-Secret": workerSecret,
      },
      body: JSON.stringify({
        source_url: sourceUrl,
        url: sourceUrl,
        platform,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        code: "metadata_refresh_failed",
        message: "Metadata preview is unavailable right now.",
      };
    }

    const body: unknown = await response.json();

    return {
      ok: true,
      metadata: normalizePreviewMetadata(getRecordValue(body, "data") ?? body),
    };
  } catch {
    return {
      ok: false,
      code: controller.signal.aborted
        ? "metadata_refresh_failed"
        : "metadata_refresh_failed",
      message: controller.signal.aborted
        ? "Metadata preview timed out."
        : "Metadata preview is unavailable right now.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function markMetadataFailed(
  adminClient: EdgeSupabaseClient,
  recipeItem: RecipeItem,
) {
  const updateResult = await adminClient
    .from("recipe_items")
    .update({
      metadata_status: "failed",
    })
    .eq("id", recipeItem.id)
    .eq("user_id", recipeItem.user_id)
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, metadata_status, source_metadata, created_at, updated_at",
    )
    .single<RecipeItem>();

  return updateResult.data ?? {
    ...recipeItem,
    metadata_status: "failed",
  };
}

function metadataErrorResponse(
  recipeItem: RecipeItem,
  code: RefreshRecipeMetadataErrorCode,
  message: string,
) {
  return jsonResponse({
    ok: true,
    data: {
      recipe_item: recipeItem,
      metadata_status: "failed",
      metadata_preview_error: {
        code,
        message,
      },
    },
  });
}

function normalizePreviewMetadata(value: unknown): PreviewMetadata {
  return {
    platform: normalizePlatform(getRecordValue(value, "platform")),
    title: getMetadataString(getRecordValue(value, "title")),
    description: getMetadataString(
      getRecordValue(value, "description") ?? getRecordValue(value, "caption"),
    ),
    thumbnailUrl: getMetadataUrl(
      getRecordValue(value, "thumbnail_url") ??
        getRecordValue(value, "thumbnailUrl") ??
        getRecordValue(value, "uploaded_thumbnail_url"),
    ),
    authorUsername: getMetadataString(
      getRecordValue(value, "author_username") ??
        getRecordValue(value, "authorUsername") ??
        getRecordValue(value, "author") ??
        getRecordValue(value, "author_name"),
    ),
    durationSeconds: getMetadataNumber(
      getRecordValue(value, "duration_seconds") ??
        getRecordValue(value, "durationSeconds"),
    ),
    resolver: getMetadataString(getRecordValue(value, "resolver")),
  };
}

function buildSafeSourceMetadata(
  sourceUrl: string,
  metadata: PreviewMetadata,
) {
  return compactJson({
    source_url: sourceUrl,
    platform: metadata.platform,
    title: metadata.title,
    description: metadata.description,
    thumbnail_url: metadata.thumbnailUrl,
    uploaded_thumbnail_url: metadata.thumbnailUrl,
    author_username: metadata.authorUsername,
    duration_seconds: metadata.durationSeconds,
    resolver: metadata.resolver,
  });
}

function compactJson(value: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) =>
      entry !== null && entry !== undefined
    ),
  ) as Json;
}

function getMetadataStatus(metadata: PreviewMetadata): MetadataStatus {
  if (metadata.title && metadata.thumbnailUrl) {
    return "completed";
  }

  return metadata.title ||
      metadata.thumbnailUrl ||
      metadata.description ||
      metadata.authorUsername ||
      metadata.durationSeconds
    ? "partial"
    : "failed";
}

function getRecipeItemId(body: unknown) {
  if (!isRecord(body) || typeof body.recipe_item_id !== "string") {
    return null;
  }

  const value = body.recipe_item_id.trim();

  return isUuid(value) ? value : null;
}

function normalizePlatform(value: unknown): RecipePlatform | null {
  return value === "instagram" ||
      value === "tiktok" ||
      value === "youtube" ||
      value === "facebook" ||
      value === "other"
    ? value
    : null;
}

function detectPlatformFromUrl(sourceUrl: string): RecipePlatform {
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return "instagram";
    }

    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      return "tiktok";
    }

    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    ) {
      return "youtube";
    }

    if (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.watch"
    ) {
      return "facebook";
    }
  } catch {
    return "other";
  }

  return "other";
}

function getMetadataString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 500)
    : null;
}

function getMetadataNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function getMetadataUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getRecordValue(value: unknown, key: string) {
  return isRecord(value) ? value[key] : undefined;
}

function getMetadataPreviewTimeoutMs() {
  const value = Number(Deno.env.get("METADATA_PREVIEW_TIMEOUT_MS"));

  return Number.isFinite(value) && value > 0 ? Math.round(value) : 7_000;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(
  code: RefreshRecipeMetadataErrorCode,
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
