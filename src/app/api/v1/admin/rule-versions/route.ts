import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { listRuleVersions, createRuleVersion } from "@/server/services/admin-service";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    return ok(await listRuleVersions());
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireAdmin(request);
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
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
