import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getMyReadings } from "@/server/services/reading-service";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const session = await requireUser(request);
    return ok(await getMyReadings({ userId: session.userId! }));
  });
}
