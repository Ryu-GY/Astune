import { z } from "zod";

type Environment = Record<string, string | undefined>;

/** Configuration errors name keys only: never log credentials or raw Zod input. */
export class EnvironmentConfigurationError extends Error {
  constructor(readonly keys: string[]) {
    super(`Invalid server configuration: ${keys.join(", ")}`);
    this.name = "EnvironmentConfigurationError";
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, source: Environment): z.output<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvironmentConfigurationError([...new Set(result.error.issues.map(issue => issue.path.join(".")))]);
  }
  return result.data;
}

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(value => value === "" || value === undefined ? undefined : value, schema.optional());

const httpUrl = z.string().url().refine(value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
});

const originUrl = httpUrl.refine(value => {
  try {
    const url = new URL(value);
    return url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
}).transform(value => new URL(value).origin);

const databaseUrl = z.string().refine(value => {
  if (value.startsWith("file:")) return value.length > 5;
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1;
  } catch { return false; }
});

export function getDatabaseConfig(source: Environment = process.env) {
  const result = parse(z.object({ DATABASE_URL: databaseUrl }), {
    ...source,
    DATABASE_URL: source.DATABASE_URL || (source.NODE_ENV === "production" ? undefined : "file:./dev.db"),
  });
  return { url: result.DATABASE_URL, provider: result.DATABASE_URL.startsWith("file:") ? "sqlite" as const : "postgresql" as const };
}

export function getAuthOrigin(source: Environment = process.env) {
  const { BETTER_AUTH_URL } = parse(z.object({ BETTER_AUTH_URL: optional(originUrl) }), source);
  if (BETTER_AUTH_URL && source.NODE_ENV === "production") {
    const url = new URL(BETTER_AUTH_URL);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new EnvironmentConfigurationError(["BETTER_AUTH_URL"]);
    }
  }
  return BETTER_AUTH_URL;
}

/** Lazy validation permits guest-only local use and builds without OAuth secrets. */
export function getGoogleAuthConfig(source: Environment = process.env) {
  if (![source.GOOGLE_CLIENT_ID, source.GOOGLE_CLIENT_SECRET, source.BETTER_AUTH_SECRET].some(Boolean)) return null;
  const result = parse(z.object({
    BETTER_AUTH_URL: originUrl,
    BETTER_AUTH_SECRET: z.string().refine(value => value.trim().length >= 32),
    GOOGLE_CLIENT_ID: z.string().trim().min(1),
    GOOGLE_CLIENT_SECRET: z.string().refine(value => value.trim().length > 0),
  }), source);
  getAuthOrigin(source);
  return {
    origin: result.BETTER_AUTH_URL, secret: result.BETTER_AUTH_SECRET,
    clientId: result.GOOGLE_CLIENT_ID, clientSecret: result.GOOGLE_CLIENT_SECRET,
  };
}

export function developmentAuthEnabled(source: Environment = process.env) {
  // Never accept header identities on a deployment, including preview deployments.
  return source.NODE_ENV === "development" && source.ASTUNE_ALLOW_DEV_AUTH === "1" && !source.VERCEL && !source.RENDER;
}

export function getAstronomyConfig(defaultTimeoutMs: number, source: Environment = process.env) {
  const result = parse(z.object({
    ASTUNE_ASTRO_API_URL: httpUrl.default("http://127.0.0.1:8000"),
    ASTUNE_ASTRO_API_KEY: optional(z.string().min(1)),
    ASTUNE_ASTRO_TIMEOUT_MS: optional(z.coerce.number().int().min(1000).max(120000)),
  }), source);
  return { origin: result.ASTUNE_ASTRO_API_URL, apiKey: result.ASTUNE_ASTRO_API_KEY,
    timeoutMs: result.ASTUNE_ASTRO_TIMEOUT_MS ?? defaultTimeoutMs };
}

export function getRuleSource(source: Environment = process.env) {
  return parse(z.object({ ASTUNE_RULE_SOURCE: z.enum(["builtin", "database"]).default("builtin") }), source).ASTUNE_RULE_SOURCE;
}
