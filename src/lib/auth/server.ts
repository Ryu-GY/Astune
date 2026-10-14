import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db/prisma";
import { getDatabaseConfig, getGoogleAuthConfig } from "@/lib/config/env";

export function googleAuthConfigured() {
  return getGoogleAuthConfig() !== null;
}

function createAuth(config: NonNullable<ReturnType<typeof getGoogleAuthConfig>>) {
  return betterAuth({
    appName: "Astune",
    baseURL: config.origin,
    secret: config.secret,
    trustedOrigins: [config.origin],
    database: prismaAdapter(prisma, {
      provider: getDatabaseConfig().provider,
      transaction: true,
    }),
    socialProviders: {
      google: {
        clientId: config.clientId, clientSecret: config.clientSecret,
        prompt: "select_account", accessType: "online",
      },
    },
    // Logout and role changes must take effect without a cookie-cache delay.
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: config.origin.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
    },
    account: { accountLinking: { enabled: false } },
    // Better Auth keys its limits by client IP and path; window is in seconds.
    rateLimit: { enabled: true, storage: "database", window: 10, max: 100 },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (instance) return instance;
  const config = getGoogleAuthConfig();
  if (!config) throw new Error("Google authentication is not configured");
  return instance = createAuth(config);
}
