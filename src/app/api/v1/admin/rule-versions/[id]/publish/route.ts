import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { publishRuleVersion } from "@/server/services/admin-service";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireAdmin(request);
    const { id } = await context.params;

    return ok(
      await publishRuleVersion(id, session.userId)
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
