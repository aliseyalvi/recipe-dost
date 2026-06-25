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

type MediaSourceMode =
  | "text_only"
  | "youtube_url"
  | "unsupported_video_link";

type RecipeItem = {
  id: string;
  user_id: string;
  source_url: string;
  platform: string | null;
  pasted_caption: string | null;
  manual_ingredients: string | null;
};

type MediaJob = {
  id: string;
  user_id: string;
  recipe_item_id: string | null;
  source_url: string;
  platform: string;
  status: string;
  source_mode: string;
  progress: number;
  thumbnail_url: string | null;
};

type Database = {
  public: {
    Tables: {
      recipe_items: {
        Row: RecipeItem;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      media_jobs: {
        Row: MediaJob;
        Insert: Omit<MediaJob, "id"> & { id?: string };
        Update: Partial<MediaJob>;
        Relationships: [];
      };
      media_job_events: {
        Row: {
          id: string;
          media_job_id: string;
          event_type: string;
          message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          media_job_id: string;
          event_type: string;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
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

type CreateMediaJobRequest = {
  recipe_item_id?: string;
  source_url: string;
  platform: RecipePlatform;
};

type CreateMediaJobErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "recipe_not_found"
  | "source_mismatch"
  | "server_not_configured"
  | "media_job_insert_failed"
  | "unexpected_media_job_error";

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
  handleCreateMediaJobRequest(request).catch(() =>
    errorResponse(
      "unexpected_media_job_error",
      "Could not queue video analysis. Please try again.",
      500,
    )
  )
);

async function handleCreateMediaJobRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return errorResponse(
      "invalid_request",
      "Use POST to create a media job.",
      405,
    );
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(
      "unauthorized",
      "Sign in to analyze a recipe video.",
      401,
    );
  }

  const clients = createSupabaseClients(authHeader);

  if (!clients) {
    return errorResponse(
      "server_not_configured",
      "Video analysis is not configured yet.",
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
      "Sign in to analyze a recipe video.",
      401,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "invalid_request",
      "Send a valid recipe link and platform.",
      400,
    );
  }

  const validation = validateCreateMediaJobRequest(body);

  if (!validation.ok) {
    return errorResponse(
      "invalid_request",
      validation.message,
      400,
    );
  }

  const input = validation.data;
  let recipeItem: RecipeItem | null = null;

  if (input.recipe_item_id) {
    const recipeResult = await clients.userClient
      .from("recipe_items")
      .select(
        "id, user_id, source_url, platform, pasted_caption, manual_ingredients",
      )
      .eq("id", input.recipe_item_id)
      .eq("user_id", user.id)
      .maybeSingle<RecipeItem>();

    if (recipeResult.error || !recipeResult.data) {
      return errorResponse(
        "recipe_not_found",
        "Saved recipe link not found.",
        404,
      );
    }

    recipeItem = recipeResult.data;

    if (
      normalizeUrl(recipeItem.source_url) !== input.source_url ||
      normalizePlatform(recipeItem.platform) !== input.platform
    ) {
      return errorResponse(
        "source_mismatch",
        "The saved recipe source does not match this analysis request.",
        409,
      );
    }
  }

  const sourceMode = getSourceMode(input.platform, recipeItem);
  const jobResult = await clients.adminClient
    .from("media_jobs")
    .insert({
      user_id: user.id,
      recipe_item_id: input.recipe_item_id ?? null,
      source_url: input.source_url,
      platform: input.platform,
      status: "queued",
      source_mode: sourceMode,
      progress: 0,
      thumbnail_url: null,
    })
    .select("id, status, progress")
    .single<{ id: string; status: string; progress: number }>();

  if (jobResult.error || !jobResult.data) {
    return errorResponse(
      "media_job_insert_failed",
      "Could not queue video analysis. Please try again.",
      500,
    );
  }

  await insertMediaJobEvent(
    clients.adminClient,
    jobResult.data.id,
    "media_job_created",
    "Media job created.",
  );

  const workerTriggered = await triggerWorker(
    clients.adminClient,
    jobResult.data.id,
  );

  return jsonResponse({
    ok: true,
    data: {
      media_job_id: jobResult.data.id,
      status: jobResult.data.status,
      progress: jobResult.data.progress,
      worker_triggered: workerTriggered,
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

function validateCreateMediaJobRequest(body: unknown):
  | { ok: true; data: CreateMediaJobRequest }
  | { ok: false; message: string } {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Send a valid recipe link and platform.",
    };
  }

  const sourceUrl = normalizeUrl(body.source_url);
  const platform = normalizePlatform(body.platform);
  const recipeItemId = typeof body.recipe_item_id === "string"
    ? body.recipe_item_id.trim()
    : undefined;

  if (!sourceUrl || !platform) {
    return {
      ok: false,
      message: "Send a valid public recipe link and supported platform.",
    };
  }

  if (recipeItemId && !isUuid(recipeItemId)) {
    return {
      ok: false,
      message: "Saved recipe ID is invalid.",
    };
  }

  return {
    ok: true,
    data: {
      source_url: sourceUrl,
      platform,
      ...(recipeItemId ? { recipe_item_id: recipeItemId } : {}),
    },
  };
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return url.toString();
  } catch {
    return null;
  }
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

function getSourceMode(
  platform: RecipePlatform,
  recipeItem: RecipeItem | null,
): MediaSourceMode {
  if (platform === "youtube") {
    return "youtube_url";
  }

  if (
    platform === "instagram" ||
    platform === "tiktok" ||
    platform === "facebook"
  ) {
    return recipeItem?.pasted_caption || recipeItem?.manual_ingredients
      ? "text_only"
      : "unsupported_video_link";
  }

  return "text_only";
}

async function triggerWorker(
  adminClient: EdgeSupabaseClient,
  mediaJobId: string,
) {
  const workerUrl = Deno.env.get("MEDIA_WORKER_URL")?.trim();
  const workerSecret = Deno.env.get("MEDIA_WORKER_SECRET")?.trim();

  if (!workerUrl || !workerSecret) {
    await insertMediaJobEvent(
      adminClient,
      mediaJobId,
      "worker_trigger_skipped",
      "Worker trigger skipped because worker config is missing.",
      {
        has_worker_url: Boolean(workerUrl),
        has_worker_secret: Boolean(workerSecret),
      },
    );
    return false;
  }

  await insertMediaJobEvent(
    adminClient,
    mediaJobId,
    "worker_trigger_started",
    "Triggering media worker.",
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/process-job`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": workerSecret,
      },
      body: JSON.stringify({
        media_job_id: mediaJobId,
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      await insertMediaJobEvent(
        adminClient,
        mediaJobId,
        "worker_trigger_success",
        "Media worker accepted the job.",
        {
          status_code: response.status,
        },
      );
      return true;
    }

    await insertMediaJobEvent(
      adminClient,
      mediaJobId,
      "worker_trigger_failed",
      "Media worker trigger failed.",
      {
        status_code: response.status,
        error_code: "worker_http_error",
      },
    );
    return false;
  } catch (error) {
    if (controller.signal.aborted) {
      await insertMediaJobEvent(
        adminClient,
        mediaJobId,
        "worker_trigger_failed",
        "Media worker trigger timed out.",
        {
          error_code: "worker_timeout",
        },
      );
      return false;
    }

    await insertMediaJobEvent(
      adminClient,
      mediaJobId,
      "worker_trigger_failed",
      "Media worker trigger threw an exception.",
      {
        error_code: "worker_fetch_error",
        error_message: sanitizeWorkerError(error, workerUrl, workerSecret),
      },
    );
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function insertMediaJobEvent(
  adminClient: EdgeSupabaseClient,
  mediaJobId: string,
  eventType: string,
  message: string,
  metadata: Json = {},
) {
  await adminClient
    .from("media_job_events")
    .insert({
      media_job_id: mediaJobId,
      event_type: eventType,
      message,
      metadata,
    });
}

function sanitizeWorkerError(
  error: unknown,
  workerUrl: string,
  workerSecret: string,
) {
  const rawMessage = error instanceof Error
    ? error.message
    : "Unknown worker fetch error.";
  const sanitized = rawMessage
    .replaceAll(workerSecret, "[redacted]")
    .replaceAll(workerUrl, "[worker_url]")
    .replace(/\s+/g, " ")
    .trim();

  return (sanitized || "Unknown worker fetch error.").slice(0, 200);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(
  code: CreateMediaJobErrorCode,
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
