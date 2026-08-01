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
  source_url: string | null;
  url?: string | null;
  link?: string | null;
  platform: string | null;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  source_video_duration_seconds: number | null;
  metadata_status: string | null;
  source_metadata: Json;
  created_at: string;
  updated_at: string;
};

type RecipeItemUpdate = {
  platform?: RecipePlatform;
  title?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  source_video_duration_seconds?: number | null;
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
  | "worker_url_missing"
  | "worker_secret_missing"
  | "source_url_missing"
  | "worker_auth_failed"
  | "worker_unavailable"
  | "worker_validation_error"
  | "worker_timeout"
  | "worker_http_error"
  | "worker_invalid_json"
  | "metadata_refresh_failed"
  | "db_update_failed"
  | "unexpected_metadata_refresh_error";

type PreviewMetadata = {
  platform: RecipePlatform | null;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  authorUsername: string | null;
  durationSeconds: number | null;
  resolver: string | null;
  tags: string[];
  metadataStatus: MetadataStatus | null;
  isTooLong: boolean | null;
  maxDurationSeconds: number | null;
  durationValidationSource: string | null;
  thumbnailSource: string | null;
  thumbnailProvider: string | null;
  thumbnailStrategy: string | null;
  thumbnailCandidateCount: number | null;
  thumbnailSelected: boolean | null;
};

type WorkerAttemptResult =
  | {
    ok: true;
    workerStatus: number;
    metadata: PreviewMetadata;
    elapsedMs: number;
    attempts: number;
  }
  | {
    ok: false;
    workerStatus: number | null;
    errorCode: RefreshRecipeMetadataErrorCode;
    elapsedMs: number;
    attempts: number;
    exceptionType?: string;
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
  handleRefreshRecipeMetadataRequest(request).catch((error) => {
    logRefreshEvent("worker_call_failed", {
      error_code: "unexpected_metadata_refresh_error",
      exception_type: getExceptionType(error),
    });

    return errorResponse(
      "unexpected_metadata_refresh_error",
      "Could not refresh recipe metadata. Please try again.",
      500,
    );
  })
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

  logRefreshEvent("refresh_metadata_start", {
    recipe_item_id: recipeItemId,
    user_id: user.id,
  });

  const recipeResult = await clients.userClient
    .from("recipe_items")
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, source_video_duration_seconds, metadata_status, source_metadata, created_at, updated_at",
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
  const sourceUrl = getRecipeSourceUrl(recipeItem);
  const sourceUrlInfo = getSafeSourceUrlInfo(sourceUrl);
  const platform = normalizePlatform(recipeItem.platform) ??
    (sourceUrlInfo.ok
      ? detectPlatformFromUrl(sourceUrlInfo.sourceUrl)
      : "other");

  logRefreshEvent("recipe_item_loaded", {
    recipe_item_id: recipeItem.id,
    user_id: user.id,
    platform,
    metadata_status: normalizeMetadataStatus(recipeItem.metadata_status),
  });

  if (!sourceUrlInfo.ok) {
    const failedItem = await markMetadataFailed(
      clients.adminClient,
      recipeItem,
      {
        errorCode: "source_url_missing",
        workerStatus: null,
        elapsedMs: 0,
        attempts: 0,
      },
    );

    return jsonResponse({
      ok: true,
      data: buildSafeRefreshResponse({
        recipeItem: failedItem,
        metadataStatus: "failed",
        workerStatus: null,
        errorCode: "source_url_missing",
        titlePresent: Boolean(failedItem.title?.trim()),
        thumbnailPresent: Boolean(failedItem.thumbnail_url),
        durationSeconds: failedItem.source_video_duration_seconds,
      }),
    });
  }

  const workerConfig = getWorkerConfig();

  if (!workerConfig.ok) {
    const failedItem = await markMetadataFailed(
      clients.adminClient,
      recipeItem,
      {
        errorCode: workerConfig.errorCode,
        workerStatus: null,
        elapsedMs: 0,
        attempts: 0,
      },
    );

    return jsonResponse({
      ok: true,
      data: buildSafeRefreshResponse({
        recipeItem: failedItem,
        metadataStatus: "failed",
        workerStatus: null,
        errorCode: workerConfig.errorCode,
        titlePresent: Boolean(failedItem.title?.trim()),
        thumbnailPresent: Boolean(failedItem.thumbnail_url),
        durationSeconds: failedItem.source_video_duration_seconds,
      }),
    });
  }

  const workerResult = await fetchWorkerMetadataPreviewWithRetry({
    recipeItemId: recipeItem.id,
    userId: user.id,
    sourceUrl: sourceUrlInfo.sourceUrl,
    sourceUrlHost: sourceUrlInfo.host,
    platform,
    workerUrl: workerConfig.workerUrl,
    workerSecret: workerConfig.workerSecret,
    timeoutMs: getMetadataPreviewTimeoutMs(),
  });

  if (!workerResult.ok) {
    logRefreshEvent(
      "worker_call_failed",
      {
        recipe_item_id: recipeItem.id,
        user_id: user.id,
        platform,
        worker_status: workerResult.workerStatus,
        elapsed_ms: workerResult.elapsedMs,
        attempts: workerResult.attempts,
        error_code: workerResult.errorCode,
        exception_type: workerResult.exceptionType,
      },
    );

    const failedItem = await markMetadataFailed(
      clients.adminClient,
      recipeItem,
      {
        errorCode: workerResult.errorCode,
        workerStatus: workerResult.workerStatus,
        elapsedMs: workerResult.elapsedMs,
        attempts: workerResult.attempts,
      },
    );

    return jsonResponse({
      ok: true,
      data: buildSafeRefreshResponse({
        recipeItem: failedItem,
        metadataStatus: "failed",
        workerStatus: workerResult.workerStatus,
        errorCode: workerResult.errorCode,
        titlePresent: Boolean(failedItem.title?.trim()),
        thumbnailPresent: Boolean(failedItem.thumbnail_url),
        durationSeconds: failedItem.source_video_duration_seconds,
      }),
    });
  }

  const nextStatus = getMetadataStatus(workerResult.metadata);
  const nextPlatform = workerResult.metadata.platform ?? platform;
  const titlePresent = Boolean(workerResult.metadata.title);
  const thumbnailPresent = Boolean(workerResult.metadata.thumbnailUrl);

  logRefreshEvent("worker_call_completed", {
    recipe_item_id: recipeItem.id,
    user_id: user.id,
    platform: nextPlatform,
    metadata_status: nextStatus,
    worker_status: workerResult.workerStatus,
    elapsed_ms: workerResult.elapsedMs,
    attempts: workerResult.attempts,
    title_present: titlePresent,
    thumbnail_present: thumbnailPresent,
  });

  logRefreshEvent("db_update_started", {
    recipe_item_id: recipeItem.id,
    user_id: user.id,
    platform: nextPlatform,
    metadata_status: nextStatus,
    worker_status: workerResult.workerStatus,
    elapsed_ms: workerResult.elapsedMs,
    attempts: workerResult.attempts,
    title_present: titlePresent,
    thumbnail_present: thumbnailPresent,
  });

  const updateResult = await clients.adminClient
    .from("recipe_items")
    .update({
      platform: nextPlatform,
      title: workerResult.metadata.title ?? recipeItem.title,
      description: workerResult.metadata.description ?? recipeItem.description,
      thumbnail_url: workerResult.metadata.thumbnailUrl ??
        recipeItem.thumbnail_url,
      source_video_duration_seconds: workerResult.metadata.durationSeconds ??
        recipeItem.source_video_duration_seconds,
      metadata_status: nextStatus,
      source_metadata: buildSafeSourceMetadata(workerResult.metadata),
    })
    .eq("id", recipeItem.id)
    .eq("user_id", user.id)
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, source_video_duration_seconds, metadata_status, source_metadata, created_at, updated_at",
    )
    .single<RecipeItem>();

  if (updateResult.error || !updateResult.data) {
    logRefreshEvent("db_update_failed", {
      recipe_item_id: recipeItem.id,
      user_id: user.id,
      platform: nextPlatform,
      metadata_status: nextStatus,
      worker_status: workerResult.workerStatus,
      elapsed_ms: workerResult.elapsedMs,
      attempts: workerResult.attempts,
      error_code: "db_update_failed",
      title_present: titlePresent,
      thumbnail_present: thumbnailPresent,
    });

    const failedItem = await markMetadataFailed(
      clients.adminClient,
      recipeItem,
      {
        errorCode: "db_update_failed",
        workerStatus: workerResult.workerStatus,
        elapsedMs: workerResult.elapsedMs,
        attempts: workerResult.attempts,
      },
    );

    return jsonResponse({
      ok: true,
      data: buildSafeRefreshResponse({
        recipeItem: failedItem,
        metadataStatus: "failed",
        workerStatus: workerResult.workerStatus,
        errorCode: "db_update_failed",
        titlePresent: Boolean(failedItem.title?.trim()),
        thumbnailPresent: Boolean(failedItem.thumbnail_url),
        durationSeconds: failedItem.source_video_duration_seconds,
      }),
    });
  }

  logRefreshEvent("db_update_completed", {
    recipe_item_id: recipeItem.id,
    user_id: user.id,
    platform: nextPlatform,
    metadata_status: nextStatus,
    worker_status: workerResult.workerStatus,
    elapsed_ms: workerResult.elapsedMs,
    attempts: workerResult.attempts,
    title_present: Boolean(updateResult.data.title?.trim()),
    thumbnail_present: Boolean(updateResult.data.thumbnail_url),
  });

  return jsonResponse({
    ok: true,
    data: buildSafeRefreshResponse({
      recipeItem: updateResult.data,
      metadataStatus: nextStatus,
      workerStatus: workerResult.workerStatus,
      errorCode: null,
      titlePresent: Boolean(updateResult.data.title?.trim()),
      thumbnailPresent: Boolean(updateResult.data.thumbnail_url),
      durationSeconds: updateResult.data.source_video_duration_seconds,
    }),
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

function getWorkerConfig():
  | { ok: true; workerUrl: string; workerSecret: string }
  | { ok: false; errorCode: "worker_url_missing" | "worker_secret_missing" } {
  const rawWorkerUrl = Deno.env.get("MEDIA_WORKER_URL")?.trim();
  const workerSecret = getFirstPresentEnvValue([
    "MEDIA_WORKER_SHARED_SECRET",
    "WORKER_API_SECRET",
    "MEDIA_WORKER_SECRET",
  ]);

  if (!rawWorkerUrl) {
    return {
      ok: false,
      errorCode: "worker_url_missing",
    };
  }

  let workerUrl: string;

  try {
    workerUrl = new URL(rawWorkerUrl).toString().replace(/\/+$/, "");
  } catch {
    return {
      ok: false,
      errorCode: "worker_url_missing",
    };
  }

  if (!workerSecret) {
    return {
      ok: false,
      errorCode: "worker_secret_missing",
    };
  }

  return {
    ok: true,
    workerUrl: workerUrl.replace(/\/+$/, ""),
    workerSecret,
  };
}

async function fetchWorkerMetadataPreviewWithRetry({
  recipeItemId,
  userId,
  sourceUrl,
  sourceUrlHost,
  platform,
  workerUrl,
  workerSecret,
  timeoutMs,
}: {
  recipeItemId: string;
  userId: string;
  sourceUrl: string;
  sourceUrlHost: string;
  platform: RecipePlatform;
  workerUrl: string;
  workerSecret: string;
  timeoutMs: number;
}) {
  const workerHost = getWorkerHost(workerUrl);

  logRefreshEvent("worker_payload_prepared", {
    recipe_item_id: recipeItemId,
    user_id: userId,
    platform,
    url_present: true,
    url_length: sourceUrl.length,
    url_host: sourceUrlHost,
  });

  await warmWorker({
    recipeItemId,
    userId,
    platform,
    workerUrl,
    workerSecret,
    workerHost,
  });

  const maxAttempts = 2;
  let elapsedMs = 0;
  let lastResult: WorkerAttemptResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    logRefreshEvent("worker_call_started", {
      recipe_item_id: recipeItemId,
      user_id: userId,
      platform,
      worker_host: workerHost,
      attempts: attempt,
    });

    const result = await fetchWorkerMetadataPreview({
      sourceUrl,
      platform,
      workerUrl,
      workerSecret,
      timeoutMs,
      attempt,
    });

    elapsedMs += result.elapsedMs;

    if (result.ok) {
      return {
        ...result,
        elapsedMs,
        attempts: attempt,
      };
    }

    lastResult = result;

    if (!shouldRetryWorkerResult(result) || attempt === maxAttempts) {
      break;
    }

    logRefreshEvent("worker_call_retrying", {
      recipe_item_id: recipeItemId,
      user_id: userId,
      platform,
      worker_host: workerHost,
      worker_status: result.workerStatus,
      elapsed_ms: elapsedMs,
      attempts: attempt,
      error_code: result.errorCode,
      exception_type: result.exceptionType,
    });

    await wait(1_800);
  }

  return normalizeFinalWorkerFailure(lastResult, elapsedMs);
}

async function fetchWorkerMetadataPreview({
  sourceUrl,
  platform,
  workerUrl,
  workerSecret,
  timeoutMs,
  attempt,
}: {
  sourceUrl: string;
  platform: RecipePlatform;
  workerUrl: string;
  workerSecret: string;
  timeoutMs: number;
  attempt: number;
}): Promise<WorkerAttemptResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = `${workerUrl}/metadata-preview`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: sourceUrl,
        platform,
      }),
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      const exceptionType = response.status === 422
        ? await getWorkerValidationExceptionType(response)
        : undefined;

      return {
        ok: false,
        workerStatus: response.status,
        errorCode: getWorkerHttpErrorCode(response.status),
        elapsedMs,
        attempts: attempt,
        exceptionType,
      };
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      return {
        ok: false,
        workerStatus: response.status,
        errorCode: "worker_invalid_json",
        elapsedMs,
        attempts: attempt,
      };
    }

    return {
      ok: true,
      workerStatus: response.status,
      metadata: normalizePreviewMetadata(
        getRecordValue(responseBody, "data") ?? responseBody,
      ),
      elapsedMs,
      attempts: attempt,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    return {
      ok: false,
      workerStatus: null,
      errorCode: controller.signal.aborted
        ? "worker_timeout"
        : "metadata_refresh_failed",
      elapsedMs,
      attempts: attempt,
      exceptionType: getExceptionType(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldRetryWorkerResult(result: WorkerAttemptResult) {
  if (result.ok) {
    return false;
  }

  return result.errorCode === "worker_timeout" ||
    result.workerStatus === 502 ||
    result.workerStatus === 503 ||
    result.workerStatus === 504;
}

async function warmWorker({
  recipeItemId,
  userId,
  platform,
  workerUrl,
  workerSecret,
  workerHost,
}: {
  recipeItemId: string;
  userId: string;
  platform: RecipePlatform;
  workerUrl: string;
  workerSecret: string;
  workerHost: string | null;
}) {
  const startedAt = Date.now();

  logRefreshEvent("worker_warmup_started", {
    recipe_item_id: recipeItemId,
    user_id: userId,
    platform,
    worker_host: workerHost,
  });

  try {
    const response = await fetch(`${workerUrl}/ping`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
    });

    logRefreshEvent("worker_warmup_completed", {
      recipe_item_id: recipeItemId,
      user_id: userId,
      platform,
      worker_host: workerHost,
      worker_status: response.status,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (error) {
    logRefreshEvent("worker_warmup_completed", {
      recipe_item_id: recipeItemId,
      user_id: userId,
      platform,
      worker_host: workerHost,
      elapsed_ms: Date.now() - startedAt,
      error_code: "metadata_refresh_failed",
      exception_type: getExceptionType(error),
    });
  }
}

function normalizeFinalWorkerFailure(
  result: WorkerAttemptResult | null,
  elapsedMs: number,
): WorkerAttemptResult {
  if (!result || result.ok) {
    return {
      ok: false,
      workerStatus: null,
      errorCode: "metadata_refresh_failed",
      elapsedMs,
      attempts: 0,
    };
  }

  return {
    ...result,
    elapsedMs,
    errorCode: result.workerStatus === 503
      ? "worker_unavailable"
      : result.errorCode,
  };
}

function getWorkerHttpErrorCode(
  status: number,
): RefreshRecipeMetadataErrorCode {
  if (status === 401 || status === 403) {
    return "worker_auth_failed";
  }

  if (status === 422) {
    return "worker_validation_error";
  }

  if (status === 503) {
    return "worker_unavailable";
  }

  return "worker_http_error";
}

async function markMetadataFailed(
  adminClient: EdgeSupabaseClient,
  recipeItem: RecipeItem,
  error: {
    errorCode: RefreshRecipeMetadataErrorCode;
    workerStatus: number | null;
    elapsedMs: number;
    attempts: number;
  },
) {
  const sourceUrl = getRecipeSourceUrl(recipeItem);
  const platform = normalizePlatform(recipeItem.platform) ??
    (sourceUrl ? detectPlatformFromUrl(sourceUrl) : "other");

  logRefreshEvent("db_update_started", {
    recipe_item_id: recipeItem.id,
    user_id: recipeItem.user_id,
    platform,
    metadata_status: "failed",
    worker_status: error.workerStatus,
    elapsed_ms: error.elapsedMs,
    attempts: error.attempts,
    error_code: error.errorCode,
  });

  const updateResult = await adminClient
    .from("recipe_items")
    .update({
      platform,
      title: recipeItem.title?.trim() || getFallbackTitle(platform),
      metadata_status: "failed",
      source_metadata: buildFailedSourceMetadata(error),
    })
    .eq("id", recipeItem.id)
    .eq("user_id", recipeItem.user_id)
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, source_video_duration_seconds, metadata_status, source_metadata, created_at, updated_at",
    )
    .single<RecipeItem>();

  if (updateResult.error || !updateResult.data) {
    logRefreshEvent("db_update_failed", {
      recipe_item_id: recipeItem.id,
      user_id: recipeItem.user_id,
      platform,
      metadata_status: "failed",
      worker_status: error.workerStatus,
      elapsed_ms: error.elapsedMs,
      attempts: error.attempts,
      error_code: "db_update_failed",
    });

    return {
      ...recipeItem,
      platform,
      title: recipeItem.title?.trim() || getFallbackTitle(platform),
      metadata_status: "failed",
    };
  }

  logRefreshEvent("db_update_completed", {
    recipe_item_id: recipeItem.id,
    user_id: recipeItem.user_id,
    platform,
    metadata_status: "failed",
    worker_status: error.workerStatus,
    elapsed_ms: error.elapsedMs,
    attempts: error.attempts,
    error_code: error.errorCode,
  });

  return updateResult.data;
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
        getRecordValue(value, "thumbnailUrl"),
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
    tags: getMetadataStringArray(getRecordValue(value, "tags")),
    metadataStatus: normalizeMetadataStatus(
      getRecordValue(value, "metadata_status") ??
        getRecordValue(value, "metadataStatus"),
    ),
    isTooLong: getMetadataBoolean(
      getRecordValue(value, "is_too_long") ??
        getRecordValue(value, "isTooLong"),
    ),
    maxDurationSeconds: getMetadataNumber(
      getRecordValue(value, "max_duration_seconds") ??
        getRecordValue(value, "maxDurationSeconds"),
    ),
    durationValidationSource: getMetadataTraceString(
      getRecordValue(value, "duration_validation_source") ??
        getRecordValue(value, "durationValidationSource"),
    ),
    thumbnailSource: getMetadataTraceString(
      getRecordValue(value, "thumbnail_source") ??
        getRecordValue(value, "thumbnailSource"),
    ),
    thumbnailProvider: getMetadataTraceString(
      getRecordValue(value, "thumbnail_provider") ??
        getRecordValue(value, "thumbnailProvider"),
    ),
    thumbnailStrategy: getMetadataTraceString(
      getRecordValue(value, "thumbnail_strategy") ??
        getRecordValue(value, "thumbnailStrategy"),
    ),
    thumbnailCandidateCount: getMetadataNumber(
      getRecordValue(value, "thumbnail_candidate_count") ??
        getRecordValue(value, "thumbnailCandidateCount"),
    ),
    thumbnailSelected: getMetadataBoolean(
      getRecordValue(value, "thumbnail_selected") ??
        getRecordValue(value, "thumbnailSelected"),
    ),
  };
}

function buildSafeSourceMetadata(metadata: PreviewMetadata) {
  return compactJson({
    platform: metadata.platform,
    resolver: metadata.resolver,
    author_username: metadata.authorUsername,
    duration_seconds: metadata.durationSeconds,
    tags: metadata.tags.length > 0 ? metadata.tags : undefined,
    metadata_status: getMetadataStatus(metadata),
    is_too_long: metadata.isTooLong,
    max_duration_seconds: metadata.maxDurationSeconds,
    duration_validation_source: metadata.durationValidationSource,
    thumbnail_source: metadata.thumbnailSource,
    thumbnail_provider: metadata.thumbnailProvider,
    thumbnail_strategy: metadata.thumbnailStrategy,
    thumbnail_candidate_count: metadata.thumbnailCandidateCount,
    thumbnail_selected: metadata.thumbnailSelected,
  });
}

function buildFailedSourceMetadata({
  errorCode,
  workerStatus,
  elapsedMs,
  attempts,
}: {
  errorCode: RefreshRecipeMetadataErrorCode;
  workerStatus: number | null;
  elapsedMs: number;
  attempts: number;
}) {
  return {
    metadata_status: "failed",
    metadata_error: {
      error_code: errorCode,
      worker_status: workerStatus,
      elapsed_ms: elapsedMs,
      attempts,
      updated_at: new Date().toISOString(),
    },
  } satisfies Json;
}

function buildSafeRefreshResponse({
  recipeItem,
  metadataStatus,
  workerStatus,
  errorCode,
  titlePresent,
  thumbnailPresent,
  durationSeconds,
}: {
  recipeItem: RecipeItem;
  metadataStatus: MetadataStatus;
  workerStatus: number | null;
  errorCode: RefreshRecipeMetadataErrorCode | null;
  titlePresent: boolean;
  thumbnailPresent: boolean;
  durationSeconds: number | null;
}) {
  const thumbnailSource = getSafeSourceMetadataString(
    recipeItem.source_metadata,
    "thumbnail_source",
  );
  const thumbnailStrategy = getSafeSourceMetadataString(
    recipeItem.source_metadata,
    "thumbnail_strategy",
  );

  return {
    recipe_item_id: recipeItem.id,
    metadata_status: metadataStatus,
    worker_status: workerStatus,
    error_code: errorCode,
    title_present: titlePresent,
    thumbnail_present: thumbnailPresent,
    ...(thumbnailSource ? { thumbnail_source: thumbnailSource } : {}),
    ...(thumbnailStrategy ? { thumbnail_strategy: thumbnailStrategy } : {}),
    duration_seconds: durationSeconds,
  };
}

function compactJson(value: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) =>
      entry !== null && entry !== undefined
    ),
  ) as Json;
}

function getMetadataStatus(metadata: PreviewMetadata): MetadataStatus {
  if (metadata.title || metadata.thumbnailUrl) {
    return "completed";
  }

  return "partial";
}

function getRecipeSourceUrl(recipeItem: RecipeItem) {
  const value = recipeItem.source_url ?? recipeItem.url ?? recipeItem.link;

  return typeof value === "string" ? value.trim() : null;
}

function getSafeSourceUrlInfo(sourceUrl: string | null):
  | {
    ok: true;
    sourceUrl: string;
    host: string;
  }
  | { ok: false } {
  if (!sourceUrl) {
    return { ok: false };
  }

  try {
    const parsedUrl = new URL(sourceUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { ok: false };
    }

    return {
      ok: true,
      sourceUrl,
      host: parsedUrl.hostname.toLowerCase().replace(/^www\./, ""),
    };
  } catch {
    return { ok: false };
  }
}

function getRecipeItemId(body: unknown) {
  if (!isRecord(body) || typeof body.recipe_item_id !== "string") {
    return null;
  }

  const value = body.recipe_item_id.trim();

  return isUuid(value) ? value : null;
}

function normalizeMetadataStatus(value: unknown): MetadataStatus | null {
  return value === "pending" ||
      value === "completed" ||
      value === "partial" ||
      value === "failed"
    ? value
    : null;
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

function getMetadataTraceString(value: unknown) {
  const text = getMetadataString(value);

  if (!text || /(?:https?:)?\/\//i.test(text)) {
    return null;
  }

  return /(authorization|bearer|cookie|secret|token)/i.test(text) ? null : text;
}

function getSafeSourceMetadataString(sourceMetadata: Json, key: string) {
  const value = getRecordValue(sourceMetadata, key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getMetadataStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => getMetadataString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);
}

function getMetadataNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function getMetadataBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
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

async function getWorkerValidationExceptionType(response: Response) {
  try {
    return `worker_response_${
      getSanitizedWorkerErrorClass(await response.text())
    }`;
  } catch {
    return "worker_response_unreadable";
  }
}

function getSanitizedWorkerErrorClass(value: string) {
  const lowerValue = value.toLowerCase();

  if (lowerValue.includes("url")) {
    return "url_validation_error";
  }

  if (lowerValue.includes("platform")) {
    return "platform_validation_error";
  }

  if (lowerValue.includes("json") || lowerValue.includes("parse")) {
    return "json_validation_error";
  }

  if (lowerValue.trim()) {
    return "validation_error";
  }

  return "empty_validation_error";
}

function getMetadataPreviewTimeoutMs() {
  const value = Number(Deno.env.get("METADATA_PREVIEW_TIMEOUT_MS"));

  return Number.isFinite(value) && value > 0 ? Math.round(value) : 30_000;
}

function logRefreshEvent(
  event: string,
  fields: {
    recipe_item_id?: string;
    user_id?: string;
    platform?: RecipePlatform | null;
    metadata_status?: MetadataStatus | null;
    worker_status?: number | null;
    worker_host?: string | null;
    elapsed_ms?: number;
    attempts?: number;
    url_present?: boolean;
    url_length?: number;
    url_host?: string;
    error_code?: RefreshRecipeMetadataErrorCode;
    exception_type?: string;
    title_present?: boolean;
    thumbnail_present?: boolean;
  } = {},
) {
  console.log(JSON.stringify({ event, ...fields }));
}

function getFirstPresentEnvValue(keys: string[]) {
  for (const key of keys) {
    const value = Deno.env.get(key)?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

function getWorkerHost(workerUrl: string) {
  try {
    return new URL(workerUrl).host;
  } catch {
    return null;
  }
}

function getFallbackTitle(platform: RecipePlatform) {
  switch (platform) {
    case "instagram":
      return "Instagram recipe link";
    case "tiktok":
      return "TikTok recipe link";
    case "youtube":
      return "YouTube recipe link";
    case "facebook":
      return "Facebook recipe link";
    case "other":
      return "Recipe link";
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExceptionType(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
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
