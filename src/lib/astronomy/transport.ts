import { upstreamHeaders } from "@/lib/utils/request-context";

export function astronomyTransport(defaultTimeoutMs: number) {
  const configuredTimeout = Number(process.env.ASTUNE_ASTRO_TIMEOUT_MS);
  const timeoutMs = Number.isInteger(configuredTimeout) && configuredTimeout >= 1000 && configuredTimeout <= 120000
    ? configuredTimeout : defaultTimeoutMs;
  const apiKey = process.env.ASTUNE_ASTRO_API_KEY;
  return {
    headers: { ...upstreamHeaders(), ...(apiKey ? { "X-Astune-Internal-Key": apiKey } : {}) },
    signal: AbortSignal.timeout(timeoutMs),
  };
}
