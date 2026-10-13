import { NextRequest } from "next/server";
import { getReadingById } from "@/server/services/reading-service";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    return ok(await getReadingById(id));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
