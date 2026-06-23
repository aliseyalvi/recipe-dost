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
    title: string | null;
    description: string | null;
    thumbnail_url: string | null;
    metadata_status: "partial" | "failed";
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

  const { originalUrl, normalizedUrl, host, parsedUrl } = validationResult;
  const platform = detectPlatform(host);
  const youtubeThumbnailUrl = getYouTubeThumbnailUrl(parsedUrl);
  const ogMetadata = await fetchOpenGraphMetadata(normalizedUrl);
  const title = ogMetadata.title;
  const description = ogMetadata.description;
  const thumbnailUrl = youtubeThumbnailUrl ?? ogMetadata.imageUrl;
  const hasMetadata = Boolean(title || description || thumbnailUrl || platform !== "other");

  return jsonResponse({
    ok: true,
    data: {
      platform,
      title,
      description,
      thumbnail_url: thumbnailUrl,
      metadata_status: hasMetadata ? "partial" : "failed",
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
    parsedUrl: URL;
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
    parsedUrl,
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

function getYouTubeThumbnailUrl(parsedUrl: URL) {
  const videoId = getYouTubeVideoId(parsedUrl);

  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

function getYouTubeVideoId(parsedUrl: URL) {
  const host = normalizeHost(parsedUrl.hostname);

  if (host === "youtu.be") {
    return cleanYouTubeVideoId(parsedUrl.pathname.slice(1));
  }

  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    const shortsMatch = parsedUrl.pathname.match(/^\/shorts\/([^/?#]+)/);
    return cleanYouTubeVideoId(parsedUrl.searchParams.get("v")) ??
      cleanYouTubeVideoId(shortsMatch?.[1]);
  }

  return null;
}

function cleanYouTubeVideoId(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue && /^[a-zA-Z0-9_-]{6,}$/.test(trimmedValue)
    ? trimmedValue
    : null;
}

async function fetchOpenGraphMetadata(
  sourceUrl: string,
  redirectsRemaining = 2,
): Promise<{
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}> {
  const fallback = {
    title: null,
    description: null,
    imageUrl: null,
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (isRedirect(response.status) && redirectsRemaining > 0) {
      const nextUrl = getRedirectUrl(sourceUrl, response.headers.get("location"));

      return nextUrl
        ? await fetchOpenGraphMetadata(nextUrl, redirectsRemaining - 1)
        : fallback;
    }

    if (!response.ok) {
      return fallback;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (
      contentType.includes("video/") ||
      contentType.includes("audio/") ||
      contentType.includes("application/octet-stream")
    ) {
      return fallback;
    }

    const html = await readTextWithLimit(response, 120_000);

    return {
      title: getOpenGraphContent(html, "og:title"),
      description: getOpenGraphContent(html, "og:description"),
      imageUrl: resolveMetadataUrl(
        sourceUrl,
        getOpenGraphContent(html, "og:image"),
      ),
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function getRedirectUrl(sourceUrl: string, location: string | null) {
  if (!location) {
    return null;
  }

  try {
    const nextUrl = new URL(location, sourceUrl);

    return nextUrl.protocol === "http:" || nextUrl.protocol === "https:"
      ? nextUrl.toString()
      : null;
  } catch {
    return null;
  }
}

async function readTextWithLimit(response: Response, limit: number) {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (totalBytes < limit) {
    const { done, value } = await reader.read();

    if (done || !value) {
      break;
    }

    const remainingBytes = limit - totalBytes;
    const chunk = value.byteLength > remainingBytes
      ? value.slice(0, remainingBytes)
      : value;

    chunks.push(chunk);
    totalBytes += chunk.byteLength;

    if (value.byteLength > remainingBytes) {
      break;
    }
  }

  return new TextDecoder().decode(concatChunks(chunks, totalBytes));
}

function concatChunks(chunks: Uint8Array[], totalBytes: number) {
  const output = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

function getOpenGraphContent(html: string, property: string) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html
    .match(/<meta\s+[^>]*>/gi)
    ?.find((value) =>
      new RegExp(
        `(?:property|name)=["']${escapedProperty}["']`,
        "i",
      ).test(value)
    );
  const content = tag?.match(/\scontent=["']([^"']+)["']/i)?.[1];

  return cleanMetadataText(content);
}

function resolveMetadataUrl(sourceUrl: string, value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, sourceUrl);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function cleanMetadataText(value: string | null | undefined) {
  const text = value
    ?.replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();

  return text ? text.slice(0, 500) : null;
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
