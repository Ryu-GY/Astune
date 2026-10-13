import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type Stage = "validation" | "astronomy" | "location" | "interpretation";
type RequestTrace = {
  requestId: string; started: number; stages: Partial<Record<Stage, number>>;
  errorCode?: string; calculation?: { engineName: string; catalogVersion: string; candidateCount: number };
};
const context = new AsyncLocalStorage<RequestTrace>();
export const getRequestId = () => context.getStore()?.requestId;

export function withRequestContext<T>(request: Request, handler: () => T): T {
  const supplied = request.headers.get("x-request-id");
  const requestId = supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(supplied) ? supplied : randomUUID();
  return context.run({ requestId, started: performance.now(), stages: {} }, handler);
}

export async function traceStage<T>(stage: Stage, action: () => Promise<T> | T): Promise<T> {
  const trace = context.getStore();
  const start = performance.now();
  try { return await action(); }
  finally { if (trace) trace.stages[stage] = (trace.stages[stage] ?? 0) + performance.now() - start; }
}

export function recordErrorCode(code: string) {
  const trace = context.getStore();
  if (trace) trace.errorCode = code;
}

export function recordCalculation(meta: { engineName: string; catalogVersion: string; candidateCount: number }) {
  const trace = context.getStore();
  if (trace) trace.calculation = { engineName: meta.engineName, catalogVersion: meta.catalogVersion, candidateCount: meta.candidateCount };
}

export function finishRequest(request: Request, response: Response) {
  const trace = context.getStore();
  if (!trace) return response;
  const durationMs = Number((performance.now() - trace.started).toFixed(3));
  const stages = Object.fromEntries(Object.entries(trace.stages).map(([key, value]) => [key, Number(value.toFixed(3))]));
  response.headers.set("Server-Timing", [...Object.entries(stages).map(([key, value]) => `${key};dur=${value}`), `total;dur=${durationMs}`].join(", "));
  // Path parameters and queries can contain identifiers; only log known route templates.
  const path = new URL(request.url).pathname;
  const route = path.replace(/(\/readings\/)(?!preview$)[^/]+$/, "$1[id]")
    .replace(/(\/rule-versions\/)[^/]+/, "$1[id]").replace(/(\/rules\/)[^/]+$/, "$1[ruleId]");
  const safeRoute = /^\/api\/v1\/(locations\/resolve|horoscopes\/daily|birth-profiles|me\/readings|readings(?:\/preview|\/\[id\])?|admin\/(?:audit-logs|rule-versions(?:\/\[id\]\/(?:publish|rules(?:\/\[ruleId\])?))?))$/.test(route) ? route : "other";
  console.info(JSON.stringify({ event: "request.completed", service: "next", requestId: trace.requestId,
    route: safeRoute, method: ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method) ? request.method : "other",
    status: response.status, durationMs, stages, ...(trace.errorCode ? { errorCode: trace.errorCode } : {}),
    ...(trace.calculation ? { calculation: trace.calculation } : {}),
  }));
  return response;
}

export function upstreamHeaders(): Record<string, string> {
  const requestId = getRequestId();
  return { "Content-Type": "application/json", ...(requestId ? { "X-Request-ID": requestId } : {}) };
}
