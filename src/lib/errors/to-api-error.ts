import { apiResponse } from "@/lib/utils/api-response";
import { recordErrorCode } from "@/lib/utils/request-context";
import { AppError } from "@/lib/errors/app-error";
import { ZodError } from "zod";
import { DomainError } from "@/lib/readings/errors";
import { publicError } from "./error-policy";

export function toApiErrorResponse(error: unknown) {
  let code = "INTERNAL_SERVER_ERROR";
  let details: unknown;
  if (error instanceof ZodError) {
    const semantic = error.issues.find(issue => issue.code === "custom" && issue.params?.errorCode);
    code = semantic?.code === "custom" ? semantic.params?.errorCode : "VALIDATION_ERROR";
    details = { fields: error.issues.map(issue => issue.path.join(".")) };
  } else if (error instanceof DomainError || error instanceof AppError) {
    code = error.code;
    details = error.details;
  }
  const result = publicError(code, details);
  recordErrorCode(result.error.code);
  return apiResponse({ success: false, error: result.error }, result.status);
}
