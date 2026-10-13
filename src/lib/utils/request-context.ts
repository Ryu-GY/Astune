import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const context = new AsyncLocalStorage<{ requestId: string }>();
export const getRequestId = () => context.getStore()?.requestId;

export function withRequestContext<T>(request: Request, handler: () => T): T {
  const supplied = request.headers.get("x-request-id");
  const requestId = supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(supplied) ? supplied : randomUUID();
  return context.run({ requestId }, handler);
}

export function upstreamHeaders(): Record<string, string> {
  const requestId = getRequestId();
  return { "Content-Type": "application/json", ...(requestId ? { "X-Request-ID": requestId } : {}) };
}
