type RecipePlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "other";

declare const Deno: {
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
};

type ParseUrlSuccess = {
  ok: true;
  data: {
    platform: RecipePlatform;
    title: null;
    description: null;
    thumbnail_url: null;
    metadata_status: "failed";
    requires_manual_caption: true;
    source_url: string;
    normalized_url: string;
    host: string;
  };
};

type ParseUrlError = {
  ok: false;
  error: {
    code:
      | "method_not_allowed"
      | "invalid_json"
      | "missing_source_url"
      | "invalid_source_url"
      | "unsupported_protocol";
    message: string;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "method_not_allowed",
          message: "Use POST to parse a recipe link.",
        },
      },
      405,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_json",
          message: "Send a JSON body with a source_url field.",
        },
      },
      400,
    );
  }

  const validationResult = validateSourceUrl(body);

  if (!validationResult.ok) {
    return jsonResponse(validationResult.response, validationResult.status);
  }

  const { originalUrl, normalizedUrl, host } = validationResult;

  // M6 deliberately avoids scraping social/video pages, downloading videos, or
  // bypassing platform protections. Future metadata providers must be legal,
  // reliable, and must preserve this link-only product boundary.
  return jsonResponse({
    ok: true,
    data: {
      platform: detectPlatform(host),
      title: null,
      description: null,
      thumbnail_url: null,
      metadata_status: "failed",
      requires_manual_caption: true,
      source_url: originalUrl,
      normalized_url: normalizedUrl,
      host,
    },
  });
});

function validateSourceUrl(body: unknown):
  | {
    ok: true;
    originalUrl: string;
    normalizedUrl: string;
    host: string;
  }
  | {
    ok: false;
    status: number;
    response: ParseUrlError;
  } {
  if (!isRecord(body) || typeof body.source_url !== "string") {
    return validationError(
      "missing_source_url",
      "Paste a recipe video link to continue.",
    );
  }

  const originalUrl = body.source_url.trim();

  if (!originalUrl) {
    return validationError(
      "missing_source_url",
      "Paste a recipe video link to continue.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(originalUrl);
  } catch {
    return validationError(
      "invalid_source_url",
      "Enter a valid link, like https://www.instagram.com/reel/...",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return validationError(
      "unsupported_protocol",
      "Recipe links must start with http:// or https://.",
    );
  }

  const host = normalizeHost(parsedUrl.hostname);
  parsedUrl.hostname = host;

  return {
    ok: true,
    originalUrl,
    normalizedUrl: parsedUrl.toString(),
    host,
  };
}

function validationError(
  code: ParseUrlError["error"]["code"],
  message: string,
): {
  ok: false;
  status: number;
  response: ParseUrlError;
} {
  return {
    ok: false,
    status: 400,
    response: {
      ok: false,
      error: {
        code,
        message,
      },
    },
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(
  body: ParseUrlSuccess | ParseUrlError,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
