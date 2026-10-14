import { AppError } from "@/lib/errors/app-error";
import { getAuthOrigin } from "@/lib/config/env";

function httpOrigin(value: string | null, originHeader = false) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (originHeader && value !== url.origin) return null;
    return url.origin;
  } catch { return null; }
}

/** Cookie-authenticated writes require positive same-origin evidence and JSON. */
export function requireSameOrigin(request: Request) {
  const allowedOrigin = getAuthOrigin() ?? httpOrigin(request.url);
  const origin = request.headers.get("origin");
  // Referer is a fallback only when Origin is absent, never for a rejected Origin.
  const sourceOrigin = origin !== null ? httpOrigin(origin, true) : httpOrigin(request.headers.get("referer"));
  if (!allowedOrigin || !sourceOrigin || sourceOrigin !== allowedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError("허용되지 않은 요청입니다.", { statusCode: 403, code: "ORIGIN_NOT_ALLOWED" });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AppError("JSON 형식으로 요청해 주세요.", { statusCode: 415, code: "JSON_REQUIRED" });
  }
}
