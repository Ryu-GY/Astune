import { readJsonBody } from "@/lib/utils/request-body";
import { z } from "zod";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createInterpretationRule } from "@/server/services/admin-service";
import { handleApiRequest, ok } from "@/lib/utils/http";
import { interpretationRuleInputSchema } from "@/lib/validation/rule";
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string; ruleId: string }> }) {
  return handleApiRequest(request, async () => {
    const session = await requireAdmin(request);
    const { id, ruleId } = await context.params;
    z.string().min(1).max(128).parse(ruleId);
    const body = interpretationRuleInputSchema.parse(await readJsonBody(request));
    return ok(await createInterpretationRule({ ...body, id: ruleId, ruleVersionId: id, adminUserId: session.userId }));
  });
}
