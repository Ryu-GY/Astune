import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createBirthProfile } from "@/server/services/reading-service";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export async function POST(request: NextRequest) {
  try {
    const session = requireUser(request);
    const body = await request.json();
    return ok(await createBirthProfile(body, { userId: session.userId! }), 201);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
