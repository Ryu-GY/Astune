import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (existsSync(".env")) process.loadEnvFile(".env");
const source = readFileSync("prisma/schema.prisma", "utf8");
const postgresSchema = source.replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace(/^(\s+\w+\s+DateTime\??[^\r\n]*)/gm, "$1 @db.Timestamptz(3)");
mkdirSync("prisma/postgresql", { recursive: true });
writeFileSync("prisma/postgresql/schema.prisma", postgresSchema);
if (process.argv[2] === "sync") process.exit(0);
const schema = process.env.DATABASE_URL?.startsWith("postgres") ? "prisma/postgresql/schema.prisma" : "prisma/schema.prisma";
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args, "--schema", schema], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
