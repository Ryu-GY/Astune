import { upstreamHeaders } from "@/lib/utils/request-context";
import { getAstronomyConfig } from "@/lib/config/env";

export function astronomyTransport(defaultTimeoutMs: number) {
  const { origin, timeoutMs, apiKey } = getAstronomyConfig(defaultTimeoutMs);
  return {
    origin,
    headers: { ...upstreamHeaders(), ...(apiKey ? { "X-Astune-Internal-Key": apiKey } : {}) },
    signal: AbortSignal.timeout(timeoutMs),
  };
}
