import { apiResponse } from "./api-response";
import { withRequestContext } from "./request-context";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export function ok<T extends object>(result: T, status = 200) {
  const { ok: _legacyOk, ...data } = result as T & { ok?: boolean };
  return apiResponse({ success: true, data }, status);
}

export function handleApiRequest(request: Request, handler: () => Promise<Response>) {
  return withRequestContext(request, async () => {
    try { return await handler(); }
    catch (error) { return toApiErrorResponse(error); }
  });
}
