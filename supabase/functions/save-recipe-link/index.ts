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

type RecipeItemInsert = {
  user_id: string;
  source_url: string;
  platform: RecipePlatform;
  title: string | null;
  thumbnail_url: null;
  duration_seconds: null;
  metadata_status: "pending";
  source_metadata: Json;
};

type Database = {
  public: {
    Tables: {
      recipe_items: {
        Row: RecipeItem;
        Insert: RecipeItemInsert;
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

const RECIPE_ITEM_SELECT =
  "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, metadata_status, source_metadata, created_at, updated_at";

const TRACKING_PARAMS = new Set([
  "si",
  "igsh",
  "fbclid",
  "gclid",
  "ref",
  "share_id",
]);

type SaveRecipeLinkErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "server_not_configured"
  | "recipe_link_insert_failed"
  | "unexpected_save_recipe_link_error";

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
  handleSaveRecipeLinkRequest(request).catch(() =>
    errorResponse(
      "unexpected_save_recipe_link_error",
      "Could not save this recipe link. Please try again.",
      500,
    )
  )
);

async function handleSaveRecipeLinkRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return errorResponse(
      "invalid_request",
      "Use POST to save a recipe link.",
      405,
    );
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(
      "unauthorized",
      "Sign in to save recipe links.",
      401,
    );
  }

  const clients = createSupabaseClients(authHeader);

  if (!clients) {
    return errorResponse(
      "server_not_configured",
      "Recipe saving is not configured yet.",
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
      "Sign in to save recipe links.",
      401,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "invalid_request",
      "Send a valid recipe link.",
      400,
    );
  }

  const validation = validateSaveRecipeLinkRequest(body);

  if (!validation.ok) {
    return errorResponse(
      "invalid_request",
      validation.message,
      400,
    );
  }

  const { normalizedUrl, normalizedSourceKey, platform, host } = validation.data;
  const safeSourceMetadata = {
    platform,
    host,
    normalized_source_key: normalizedSourceKey,
  } satisfies Json;
  const existingByUrlResult = await clients.adminClient
    .from("recipe_items")
    .select(RECIPE_ITEM_SELECT)
    .eq("user_id", user.id)
    .eq("source_url", normalizedUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RecipeItem>();

  if (existingByUrlResult.error) {
    return errorResponse(
      "recipe_link_insert_failed",
      "Could not save this recipe link. Please try again.",
      500,
    );
  }

  if (existingByUrlResult.data) {
    return duplicateResponse(existingByUrlResult.data);
  }

  const existingByKeyResult = await clients.adminClient
    .from("recipe_items")
    .select(RECIPE_ITEM_SELECT)
    .eq("user_id", user.id)
    .contains("source_metadata", {
      normalized_source_key: normalizedSourceKey,
    })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RecipeItem>();

  if (existingByKeyResult.error) {
    return errorResponse(
      "recipe_link_insert_failed",
      "Could not save this recipe link. Please try again.",
      500,
    );
  }

  if (existingByKeyResult.data) {
    return duplicateResponse(existingByKeyResult.data);
  }

  const legacyDuplicateResult = await clients.adminClient
    .from("recipe_items")
    .select(RECIPE_ITEM_SELECT)
    .eq("user_id", user.id)
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(500);

  if (legacyDuplicateResult.error) {
    return errorResponse(
      "recipe_link_insert_failed",
      "Could not save this recipe link. Please try again.",
      500,
    );
  }

  const legacyDuplicate = legacyDuplicateResult.data?.find(
    (recipeItem) =>
      normalizeRecipeSourceUrl(recipeItem.source_url) === normalizedSourceKey,
  );

  if (legacyDuplicate) {
    return duplicateResponse(legacyDuplicate);
  }

  const insertResult = await clients.adminClient
    .from("recipe_items")
    .insert({
      user_id: user.id,
      source_url: normalizedUrl,
      platform,
      title: getFallbackTitle(platform),
      thumbnail_url: null,
      duration_seconds: null,
      metadata_status: "pending",
      source_metadata: safeSourceMetadata,
    })
    .select(RECIPE_ITEM_SELECT)
    .single<RecipeItem>();

  if (insertResult.error || !insertResult.data) {
    return errorResponse(
      "recipe_link_insert_failed",
      "Could not save this recipe link. Please try again.",
      500,
    );
  }

  return jsonResponse({
    ok: true,
    data: {
      recipe_item: insertResult.data,
      duplicate: false,
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

function validateSaveRecipeLinkRequest(body: unknown):
  | {
    ok: true;
    data: {
      normalizedUrl: string;
      normalizedSourceKey: string;
      platform: RecipePlatform;
      host: string;
    };
  }
  | { ok: false; message: string } {
  if (!isRecord(body) || typeof body.url !== "string") {
    return {
      ok: false,
      message: "Paste a recipe link to continue.",
    };
  }

  const normalizedUrl = normalizeUrl(body.url);

  if (!normalizedUrl) {
    return {
      ok: false,
      message: "Enter a valid link, like https://www.instagram.com/reel/...",
    };
  }

  const parsedUrl = new URL(normalizedUrl);
  const host = parsedUrl.hostname;
  const normalizedSourceKey = normalizeRecipeSourceUrl(normalizedUrl);

  if (!normalizedSourceKey) {
    return {
      ok: false,
      message: "Enter a valid link, like https://www.instagram.com/reel/...",
    };
  }

  return {
    ok: true,
    data: {
      normalizedUrl,
      normalizedSourceKey,
      platform: detectPlatform(host),
      host,
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

    url.hostname = normalizeHost(url.hostname);
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function normalizeRecipeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    const host = normalizeHost(url.hostname);
    const pathParts = getPathParts(url);

    if (host === "youtu.be") {
      return pathParts[0] ? `youtube:${pathParts[0]}` : null;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (pathParts[0] === "shorts" && pathParts[1]) {
        return `youtube:${pathParts[1]}`;
      }

      const videoId = cleanSegment(url.searchParams.get("v"));
      return videoId ? `youtube:${videoId}` : canonicalUrlKey(url, host);
    }

    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      if ((pathParts[0] === "reel" || pathParts[0] === "p") && pathParts[1]) {
        return `instagram:${pathParts[0]}:${pathParts[1]}`;
      }

      return canonicalUrlKey(url, host);
    }

    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      const videoIndex = pathParts.indexOf("video");

      if (videoIndex >= 0 && pathParts[videoIndex + 1]) {
        return `tiktok:${pathParts[videoIndex + 1]}`;
      }

      return canonicalUrlKey(url, host);
    }

    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
      return canonicalUrlKey(url, host);
    }

    if (host === "fb.watch") {
      return pathParts[0] ? `facebook:watch:${pathParts[0]}` : null;
    }

    if (host === "facebook.com" || host.endsWith(".facebook.com")) {
      const videoId = cleanSegment(url.searchParams.get("v")) ??
        getPathIdAfter(pathParts, "videos") ??
        getPathIdAfter(pathParts, "watch");

      return videoId ? `facebook:${videoId}` : canonicalUrlKey(url, host);
    }

    return canonicalUrlKey(url, host);
  } catch {
    return null;
  }
}

function canonicalUrlKey(url: URL, host: string) {
  const params = new URLSearchParams(url.searchParams);

  for (const key of Array.from(params.keys())) {
    if (isTrackingParam(key)) {
      params.delete(key);
    }
  }

  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const query = params.toString();

  return `${host}${pathname}${query ? `?${query}` : ""}`;
}

function getPathParts(url: URL) {
  return url.pathname
    .split("/")
    .map((part) => cleanSegment(part))
    .filter((part): part is string => Boolean(part));
}

function getPathIdAfter(parts: string[], marker: string) {
  const index = parts.indexOf(marker);

  return index >= 0 ? parts[index + 1] : null;
}

function cleanSegment(value: string | null | undefined) {
  return value?.trim() || null;
}

function isTrackingParam(key: string) {
  const normalizedKey = key.toLowerCase();

  return TRACKING_PARAMS.has(normalizedKey) || normalizedKey.startsWith("utm_");
}

function detectPlatform(host: string): RecipePlatform {
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

  return "other";
}

function getFallbackTitle(platform: RecipePlatform) {
  if (platform === "other") {
    return "Saved recipe link";
  }

  return `${capitalize(platform)} recipe link`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(
  code: SaveRecipeLinkErrorCode,
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

function duplicateResponse(recipeItem: RecipeItem) {
  return jsonResponse({
    ok: true,
    data: {
      duplicate: true,
      message: "already_saved",
      recipe_item: recipeItem,
    },
  });
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
