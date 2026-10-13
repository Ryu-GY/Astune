import { apiResponse } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/app-error";
import { ZodError } from "zod";
import { DomainError } from "@/lib/readings/errors";

export function toApiErrorResponse(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return apiResponse({ success: false, error: {
      code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.",
      details: error instanceof ZodError ? error.flatten() : null
    } }, 400);
  }
  if (error instanceof DomainError) {
    return apiResponse({ success: false, error: {
      code: error.code, message: error.message, details: error.details ?? null
    } }, error.status);
  }
  if (error instanceof AppError) {
    return apiResponse(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null
        }
      },
      error.statusCode
    );
  }

  console.error(error);

  return apiResponse(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "서버 내부 오류가 발생했습니다.",
        details: null
      }
    },
    500
  );
}
