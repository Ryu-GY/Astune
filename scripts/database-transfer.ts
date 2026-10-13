import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { exportDatabase, importDatabase, modelOrder } from "../src/lib/db/transfer";
async function main() {
  const [mode, path] = process.argv.slice(2);
  if (!path || !["export", "import"].includes(mode)) throw new Error("Usage: npm run db:transfer -- export|import <path.astune-backup.json>");
  const prisma = new PrismaClient();
  try {
    if (mode === "export") {
      const snapshot = await exportDatabase(prisma);
      writeFileSync(path, JSON.stringify(snapshot, null, 2), { flag: "wx", mode: 0o600 });
      console.log("Backup created. Store it privately: it contains personal data and session credentials.");
    } else {
      const snapshot = JSON.parse(readFileSync(path, "utf8"));
      await importDatabase(prisma, snapshot);
      console.log("Import committed", Object.fromEntries(modelOrder.map(name => [name, snapshot.tables[name].length])));
    }
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Transfer failed"); process.exitCode = 1; });
