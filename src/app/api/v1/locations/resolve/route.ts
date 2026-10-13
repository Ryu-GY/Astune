import { NextRequest } from "next/server";
import { resolveLocationSchema, resolveLocationBodySchema } from "@/lib/validation/location";
import { requestLocations } from "@/lib/geocoding/core-client";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export async function GET(request: NextRequest) {
  try {
    const query = resolveLocationSchema.parse({
      q: request.nextUrl.searchParams.get("q")
    });

    return ok(await requestLocations({q: query.q, allowExternal: false}));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      return Response.json({ok: false, error: {code: "VALIDATION_ERROR", message: "유효한 JSON이 필요합니다."}}, {status: 400});
    }
    return ok(await requestLocations(resolveLocationBodySchema.parse(body)));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
