import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { publishRuleVersion } from "@/server/services/admin-service";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRequest(request, async () => {
    const session = await requireAdmin(request);
    const { id } = await context.params;

    return ok(
      await publishRuleVersion(id, session.userId)
    );
  });
}
