import { createClient } from "@supabase/supabase-js";

type DeleteAccountErrorCode =
  | "invalid_request"
  | "server_not_configured"
  | "unauthorized"
  | "deletion_failed";

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
  handleDeleteAccountRequest(request).catch(() =>
    errorResponse(
      "deletion_failed",
      "Account deletion could not be completed. Please try again.",
      500,
    )
  )
);

async function handleDeleteAccountRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("invalid_request", "Use POST to delete an account.", 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("unauthorized", "Sign in again before deleting your account.", 401);
  }

  const clients = createSupabaseClients(authHeader);
  if (!clients) {
    return errorResponse(
      "server_not_configured",
      "Account deletion is not configured.",
      500,
    );
  }

  const {
    data: { user },
    error: authError,
  } = await clients.userClient.auth.getUser();

  if (authError || !user) {
    return errorResponse("unauthorized", "Sign in again before deleting your account.", 401);
  }

  const { error: deletionError } = await clients.adminClient.auth.admin
    .deleteUser(user.id, false);

  if (deletionError) {
    return errorResponse(
      "deletion_failed",
      "Account deletion could not be completed. Please try again.",
      500,
    );
  }

  return jsonResponse({ ok: true, data: { deleted: true } });
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

function errorResponse(
  code: DeleteAccountErrorCode,
  message: string,
  status: number,
) {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
