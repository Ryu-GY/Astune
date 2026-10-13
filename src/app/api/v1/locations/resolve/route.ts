import { readJsonBody } from "@/lib/utils/request-body";
import { NextRequest } from "next/server";
import { resolveLocationSchema, resolveLocationBodySchema } from "@/lib/validation/location";
import { requestLocations } from "@/lib/geocoding/core-client";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const query = resolveLocationSchema.parse({
      q: request.nextUrl.searchParams.get("q")
    });

    return ok(await requestLocations(resolveLocationBodySchema.parse({query: query.q, allowExternal: false})));
  });
}

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async () => ok(await requestLocations(resolveLocationBodySchema.parse(await readJsonBody(request)))));
}
