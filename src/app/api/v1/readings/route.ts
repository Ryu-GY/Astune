import { readJsonBody } from "@/lib/utils/request-body";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createReading } from "@/server/services/reading-service";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const session = await requireUser(request);
    const body = await readJsonBody(request);
    return ok(await createReading(body, { userId: session.userId! }), 201);
  });
}
