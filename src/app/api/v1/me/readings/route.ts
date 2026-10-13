import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getMyReadings } from "@/server/services/reading-service";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export async function GET(request: NextRequest) {
  try {
    const session = requireUser(request);
    return ok(await getMyReadings({ userId: session.userId! }));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
