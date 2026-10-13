import { NextRequest } from "next/server";
import { previewReading } from "@/server/services/preview-service";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const body = await request.json();
    return ok(await previewReading(body));
  });
}
