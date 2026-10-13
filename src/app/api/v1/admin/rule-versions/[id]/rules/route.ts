import { readJsonBody } from "@/lib/utils/request-body";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createInterpretationRule } from "@/server/services/admin-service";
import { handleApiRequest, ok } from "@/lib/utils/http";
import { interpretationRuleInputSchema } from "@/lib/validation/rule";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleApiRequest(request, async () => {
    const session = await requireAdmin(request);
    const { id } = await context.params;
    const body = interpretationRuleInputSchema.parse(await readJsonBody(request));

    return ok(
      await createInterpretationRule({
        ...body,
        ruleVersionId: id,
        adminUserId: session.userId
      }),
      201
    );
  });
}
