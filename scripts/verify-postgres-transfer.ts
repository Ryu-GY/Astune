import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { testDatabase } from "../tests/helpers/database";
import { exportDatabase, importDatabase } from "../src/lib/db/transfer";
import { seedDefaultRules } from "../prisma/seed-rules";

async function main() {
// Deliberately restricted to a disposable local database, never a cloud database.
const mode = process.argv[2];
const file = ".audit-tmp/postgres-transfer.astune-backup.json";
if (mode === "export") {
  if (process.env.DATABASE_URL?.startsWith("postgres")) throw new Error("Export fixture requires a SQLite client");
  const source = testDatabase();
  try {
    const user = await source.prisma.user.create({ data: { email: "transfer@example.test", role: "ADMIN" } });
    await seedDefaultRules(source.prisma, user.id);
    await source.prisma.birthProfile.create({ data: { userId: user.id, label: "Synthetic DST fixture",
      birthAtLocal: "2020-11-01T01:30:00", timezone: "America/New_York", latitude: 40.7, longitude: -74,
      dstFold: 1, maxMagnitude: 5.5 } });
    await source.prisma.account.create({ data: { accountId: "synthetic-provider", providerId: "google", userId: user.id } });
    await source.prisma.rateLimit.create({ data: { key: "synthetic", count: 2, lastRequest: 1791860938123n } });
    mkdirSync(".audit-tmp", { recursive: true });
    writeFileSync(file, JSON.stringify(await exportDatabase(source.prisma)));
    console.log("Synthetic SQLite export complete.");
  } finally { await source.cleanup(); }
} else if (mode === "verify") {
  const url = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) || url.pathname !== "/astune") {
    throw new Error("Verification requires the disposable localhost/astune Compose database");
  }
  const db = new PrismaClient();
  try {
    const snapshot = JSON.parse(readFileSync(file, "utf8"));
    await importDatabase(db, snapshot);
    assert.deepEqual((await exportDatabase(db)).tables, snapshot.tables);
    await assert.rejects(importDatabase(db, snapshot), /Destination must be empty/);
    await assert.rejects(db.birthProfile.updateMany({ data: { dstFold: 2 } }));
    assert.equal(await db.ruleVersion.count({ where: { status: "PUBLISHED" } }), 1);
    console.log("Real PostgreSQL import, exact round-trip, overwrite guard and SQL constraints passed.");
  } finally { await db.$disconnect(); }
} else throw new Error("Usage: verify-postgres-transfer.ts export|verify");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
