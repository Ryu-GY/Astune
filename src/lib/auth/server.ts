import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db/prisma";

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL);
}

function createAuth() {
  return betterAuth({
    appName: "Astune",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, {
      provider: process.env.DATABASE_URL?.startsWith("postgres") ? "postgresql" : "sqlite",
      transaction: true,
    }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        prompt: "select_account", accessType: "online",
      },
    },
    // Logout and role changes must take effect without a cookie-cache delay.
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    account: { accountLinking: { enabled: false } },
    rateLimit: { enabled: true, storage: "database" },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (!googleAuthConfigured()) throw new Error("Google authentication is not configured");
  return instance ??= createAuth();
}
