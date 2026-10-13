import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleApiRequest, ok } from "@/lib/utils/http";
import { getBirthProfileById } from "@/server/services/reading-service";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRequest(request, async () => {
    const session = await requireUser(request);
    const { id } = await context.params;
    return ok(await getBirthProfileById(id, session));
  });
}
