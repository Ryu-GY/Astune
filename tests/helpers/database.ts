import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export function testDatabase(legacy = false) {
  const scratch = mkdtempSync(join(tmpdir(), "astune-rules-test-"));
  const databaseUrl = "file:" + join(scratch, "rules.db").replaceAll("\\", "/");
  writeFileSync(join(scratch, "rules.db"), "");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const cli = (...args: string[]) => execFileSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe"
  });
  const migrate = () => cli("migrate", "deploy");
  if (legacy) {
    cli("db", "execute", "--file", "prisma/migrations/20261013000000_initial/migration.sql", "--schema", "prisma/schema.prisma");
    cli("migrate", "resolve", "--applied", "20261013000000_initial");
  } else migrate();
  return {
    prisma, databaseUrl, migrate,
    async cleanup() {
      await prisma.$disconnect();
      const checked = resolve(scratch);
      if (!checked.startsWith(resolve(tmpdir()) + sep) || !checked.split(sep).at(-1)?.startsWith("astune-rules-test-")) {
        throw new Error("Unexpected test cleanup path");
      }
      rmSync(checked, { recursive: true, force: true });
    }
  };
}
