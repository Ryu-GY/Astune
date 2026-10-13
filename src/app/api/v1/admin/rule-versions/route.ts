import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { listRuleVersions, createRuleVersion } from "@/server/services/admin-service";
import { handleApiRequest, ok } from "@/lib/utils/http";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    await requireAdmin(request);
    return ok(await listRuleVersions());
  });
}

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const session = await requireAdmin(request);
    const body = (await request.json()) as { name?: string; description?: string };

    if (!body.name?.trim()) {
      throw new AppError("name은 필수입니다.", {
        statusCode: 400,
        code: "INVALID_RULE_VERSION_NAME"
      });
    }

    return ok(
      await createRuleVersion({
        name: body.name.trim(),
        description: body.description?.trim(),
        createdById: session.userId
      }),
      201
    );
  });
}
