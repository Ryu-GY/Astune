import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Same entry point on Windows and CI. No shell globbing, local DB migration, or server required.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "astune-verify-"));
const guardDatabase = join(scratch, "unused.db");
writeFileSync(guardDatabase, "");
const env = { ...process.env, DATABASE_URL: `file:${guardDatabase.replaceAll("\\", "/")}`,
  NODE_ENV: "test", ASTUNE_ALLOW_DEV_AUTH: "0", ASTUNE_RULE_SOURCE: "builtin", GEOCODER_ENABLED: "false" };
// Tests create synthetic sessions themselves; production credentials are never needed.
for (const key of ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) delete env[key];
const node = (script, ...args) => [process.execPath, [join(root, script), ...args]];
const testFiles = readdirSync(join(root, "tests")).filter(file => file.endsWith(".test.ts")).sort().map(file => join("tests", file));
const steps = [
  ["Generate Prisma client", ...node("node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.prisma")],
  ["Check local astronomy data", "uv", ["run", "--locked", "--directory", "astune-backend", "python", "-m", "app.astro.check_data"]],
  ["TypeScript core and integration tests", process.execPath, ["--import", "tsx", "--test", ...testFiles]],
  ["Python core tests", "uv", ["run", "--locked", "--directory", "astune-backend", "pytest", "-q", "-rs"]],
  ["TypeScript type check", ...node("node_modules/typescript/bin/tsc", "--noEmit")],
];

try {
  for (const [label, command, args] of steps) {
    console.log(`\n${label}`);
    const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${label} failed (${result.status ?? result.signal}). ${label.includes("astronomy") ? "Run npm run backend:data first." : ""}`);
    }
  }
  console.log("\nT701/T702 verification passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  const target = resolve(scratch);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !target.split(sep).at(-1)?.startsWith("astune-verify-")) {
    throw new Error("Unexpected verification cleanup path");
  }
  rmSync(target, { recursive: true, force: true });
}
