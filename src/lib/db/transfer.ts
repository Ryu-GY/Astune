import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";

export const modelOrder = ["user", "birthProfile", "ruleVersion", "interpretationRule", "reading", "adminAuditLog", "account", "session", "verification", "rateLimit"] as const;
type Row = Record<string, unknown>;
type Delegate = { findMany: (args: { orderBy: { id: "asc" } }) => Promise<Row[]>; count: () => Promise<number>; createMany: (args: { data: Row[] }) => Promise<unknown> };
function models(tx: Prisma.TransactionClient) { return tx as unknown as Record<typeof modelOrder[number], Delegate>; }
export function encode(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (typeof value === "bigint") return { $bigint: String(value) };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  return value;
}
export function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    if ("$date" in value) return new Date(String(value.$date));
    if ("$bigint" in value) return BigInt(String(value.$bigint));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  }
  return value;
}
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export async function exportDatabase(db: PrismaClient) {
  const tables = await db.$transaction(async tx => {
    const result: Record<string, unknown> = {};
    for (const name of modelOrder) result[name] = encode(await models(tx)[name].findMany({ orderBy: { id: "asc" } }));
    return result;
  }, { isolationLevel: "Serializable", timeout: 120000 });
  return { format: "astune-backup-v1", createdAt: new Date().toISOString(), checksum: digest(tables), tables };
}
export async function importDatabase(db: PrismaClient, snapshot: ReturnType<typeof JSON.parse>) {
  if (snapshot.format !== "astune-backup-v1" || snapshot.checksum !== digest(snapshot.tables) ||
    modelOrder.some(name => !Array.isArray(snapshot.tables[name]))) throw new Error("Invalid or corrupted Astune backup");
  await db.$transaction(async tx => {
    for (const name of modelOrder) if (await models(tx)[name].count()) throw new Error("Destination must be empty; existing data will not be overwritten");
    for (const name of modelOrder) {
      const rows = decode(snapshot.tables[name]) as Row[];
      // Bounded batches keep large exports within database parameter limits.
      for (let offset = 0; offset < rows.length; offset += 100) await models(tx)[name].createMany({ data: rows.slice(offset, offset + 100) });
      if (await models(tx)[name].count() !== rows.length) throw new Error(`Import count mismatch: ${name}`);
    }
  }, { isolationLevel: "Serializable", timeout: 120000 });
}
