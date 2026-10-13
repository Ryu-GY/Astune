import { NextRequest } from "next/server";
import { getReadingById } from "@/server/services/reading-service";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRequest(request, async () => {
    const { id } = await context.params;
    return ok(await getReadingById(id));
  });
}
