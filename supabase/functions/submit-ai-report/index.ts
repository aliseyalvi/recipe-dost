import { createClient } from "@supabase/supabase-js";

const reportCategories = new Set([
  "incorrect_or_misleading",
  "unsafe_cooking_instructions",
  "allergy_or_food_safety",
  "offensive_content",
  "other",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReportErrorCode =
  | "invalid_request"
  | "server_not_configured"
  | "unauthorized"
  | "recipe_not_found"
  | "submission_failed";

declare const Deno: {
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

Deno.serve((request) =>
  handleSubmitAiReportRequest(request).catch(() =>
    errorResponse(
      "submission_failed",
      "The report could not be submitted. Please try again.",
      500,
    )
  )
);

async function handleSubmitAiReportRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return errorResponse("invalid_request", "Use POST to submit a report.", 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("unauthorized", "Sign in again before submitting a report.", 401);
  }

  const clients = createSupabaseClients(authHeader);
  if (!clients) {
    return errorResponse("server_not_configured", "Reporting is not configured.", 500);
  }

  const {
    data: { user },
    error: authError,
  } = await clients.userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse("unauthorized", "Sign in again before submitting a report.", 401);
  }

  const body = await readJsonBody(request);
  if (!body) {
    return errorResponse("invalid_request", "Send a valid report.", 400);
  }

  const recipeCardId = getString(body.recipe_card_id);
  const category = getString(body.category);
  const note = getOptionalString(body.note);
  const appVersion = getOptionalShortString(body.app_version, 40);
  const buildNumber = getOptionalShortString(body.build_number, 40);

  if (
    !recipeCardId ||
    !uuidPattern.test(recipeCardId) ||
    !category ||
    !reportCategories.has(category) ||
    note === undefined ||
    (note?.length ?? 0) > 500
  ) {
    return errorResponse("invalid_request", "Choose a valid report category and try again.", 400);
  }

  const { data: recipeCard, error: recipeError } = await clients.adminClient
    .from("recipe_cards")
    .select("id")
    .eq("id", recipeCardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (recipeError || !recipeCard) {
    return errorResponse("recipe_not_found", "This recipe card is no longer available.", 404);
  }

  const { error: insertError } = await clients.adminClient
    .from("ai_content_reports")
    .insert({
      user_id: user.id,
      recipe_card_id: recipeCardId,
      category,
      note,
      app_version: appVersion,
      build_number: buildNumber,
    });

  if (insertError?.code === "23505") {
    return jsonResponse({ ok: true, data: { submitted: true, duplicate: true } });
  }
  if (insertError) {
    return errorResponse(
      "submission_failed",
      "The report could not be submitted. Please try again.",
      500,
    );
  }

  return jsonResponse({ ok: true, data: { submitted: true, duplicate: false } });
}

function createSupabaseClients(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !publishableKey || !serverKey) return null;

  return {
    userClient: createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    }),
    adminClient: createClient(supabaseUrl, serverKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

async function readJsonBody(request: Request) {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object"
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOptionalString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value.trim() || null : undefined;
}

function getOptionalShortString(value: unknown, maxLength: number) {
  const normalized = getOptionalString(value);
  return normalized === undefined || (normalized?.length ?? 0) > maxLength
    ? null
    : normalized;
}

function errorResponse(code: ReportErrorCode, message: string, status: number) {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
