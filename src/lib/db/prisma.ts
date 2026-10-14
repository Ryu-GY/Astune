import { PrismaClient } from "@prisma/client";
import { getDatabaseConfig } from "@/lib/config/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: getDatabaseConfig().url } },
    // Request telemetry reports a safe error code; Prisma messages can contain input values.
    log: []
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
