import { NextRequest } from "next/server";
import { resolveLocationSchema } from "@/lib/validation/location";
import { resolveCities } from "@/lib/geocoding/local-resolver";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export async function GET(request: NextRequest) {
  try {
    const query = resolveLocationSchema.parse({
      q: request.nextUrl.searchParams.get("q")
    });

    return ok({
      ok: true,
      items: resolveCities(query.q)
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
