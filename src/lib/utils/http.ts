import { apiResponse } from "./api-response";
import { finishRequest, withRequestContext } from "./request-context";
import { toApiErrorResponse } from "@/lib/errors/to-api-error";

export function ok<T extends object>(result: T, status = 200) {
  const { ok: _legacyOk, ...data } = result as T & { ok?: boolean };
  return apiResponse({ success: true, data }, status);
}

export function handleApiRequest(request: Request, handler: () => Promise<Response>) {
  return withRequestContext(request, async () => {
    let response: Response;
    try { response = await handler(); }
    catch (error) { response = toApiErrorResponse(error); }
    return finishRequest(request, response);
  });
}
