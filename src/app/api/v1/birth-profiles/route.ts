import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createBirthProfile } from "@/server/services/reading-service";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const session = await requireUser(request);
    const body = await request.json();
    return ok(await createBirthProfile(body, { userId: session.userId! }), 201);
  });
}
