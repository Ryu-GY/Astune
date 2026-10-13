import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createInterpretationRule } from "@/server/services/admin-service";
import { ok } from "@/lib/utils/http";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";
import { AppError } from "@/lib/errors/app-error";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireAdmin(request);
    const { id } = await context.params;
    const body = (await request.json()) as {
      constellationCode?: string;
      title?: string;
      keywords?: string[];
      generalText?: string;
      loveText?: string;
      careerText?: string;
      moneyText?: string;
    };

    if (!body.constellationCode || !body.title) {
      throw new AppError("constellationCode와 title은 필수입니다.", {
        statusCode: 400,
        code: "INVALID_RULE_INPUT"
      });
    }

    return ok(
      await createInterpretationRule({
        ruleVersionId: id,
        constellationCode: body.constellationCode,
        title: body.title,
        keywords: body.keywords || [],
        generalText: body.generalText || "",
        loveText: body.loveText || "",
        careerText: body.careerText || "",
        moneyText: body.moneyText || "",
        adminUserId: session.userId
      }),
      201
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
