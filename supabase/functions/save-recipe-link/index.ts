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

  const { normalizedUrl, platform, host } = validation.data;
  const safeSourceMetadata = {
    source_url: normalizedUrl,
    platform,
    host,
  } satisfies Json;
  const existingResult = await clients.adminClient
    .from("recipe_items")
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, metadata_status, source_metadata, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .eq("source_url", normalizedUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RecipeItem>();

  if (existingResult.error) {
    return errorResponse(
      "recipe_link_insert_failed",
      "Could not save this recipe link. Please try again.",
      500,
    );
  }

  if (existingResult.data) {
    return jsonResponse({
      ok: true,
      data: {
        recipe_item: existingResult.data,
      },
    });
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
    .select(
      "id, user_id, source_url, platform, title, description, thumbnail_url, duration_seconds, metadata_status, source_metadata, created_at, updated_at",
    )
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

  return {
    ok: true,
    data: {
      normalizedUrl,
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
