import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

// SQLite's schema engine on Windows requires the database file to exist first.
const url = process.env.DATABASE_URL || "file:./dev.db";
if (url.startsWith("file:") && !url.includes(":memory:")) {
  const filename = url.slice(5).split("?")[0];
  const path = isAbsolute(filename) ? filename : resolve("prisma", filename);
  mkdirSync(dirname(path), { recursive: true });
  closeSync(openSync(path, "a"));
}
