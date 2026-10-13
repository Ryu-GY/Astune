import { NextRequest } from "next/server";
import { previewReading } from "@/server/services/preview-service";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return ok(await previewReading(body));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
