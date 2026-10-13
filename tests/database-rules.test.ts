import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaRuleRepository } from "../src/lib/readings/repositories/prisma-rule-repository";
import { PreviewReadingService } from "../src/lib/readings/preview-reading-service";

test("published database rules drive interpretation; draft versions do not", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "astune-rules-test-"));
  const databaseUrl = "file:" + join(scratch, "rules.db").replaceAll("\\", "/");
  writeFileSync(join(scratch, "rules.db"), "");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe"
    });
    const user = await prisma.user.create({ data: { email: "rules-test@astune.local", role: "ADMIN" } });
    const version = await prisma.ruleVersion.create({ data: {
      name: "published-test", status: "PUBLISHED", publishedAt: new Date(), createdById: user.id,
      rules: { create: { constellationCode: "Ori", title: "Database title", keywordsCsv: "몰입", generalText: "게시된 {starName} 해석", loveText: "DB love", careerText: "DB career", moneyText: "DB money" } }
    } });
    await prisma.ruleVersion.create({ data: { name: "draft-test", createdById: user.id, status: "DRAFT" } });
    const result = await new PreviewReadingService(new PrismaRuleRepository(prisma)).generate({
      input: { birthDate: "1995-05-05", birthTimeLocal: "15:00:00", timezone: "Asia/Seoul", locationName: "Seoul", latitude: 37.5, longitude: 127 },
      astro: { selectedStar: { id: 27989, displayName: "Betelgeuse", magnitude: 0.5 }, selectedConstellation: { code: "Ori", nameKo: "오리온자리" }, metrics: { altitudeDeg: 65, azimuthDeg: 170, zenithDistanceDeg: 25 } }
    });
    assert.equal(result.ruleVersionId, version.id);
    assert.equal(result.summary, "게시된 Betelgeuse 해석");
    assert.equal(result.sections.find(s => s.type === "career")?.content, "DB career");
  } finally {
    await prisma.$disconnect();
    const checked = resolve(scratch);
    if (!checked.startsWith(resolve(tmpdir()) + sep) || !checked.split(sep).at(-1)?.startsWith("astune-rules-test-")) {
      throw new Error("Unexpected test cleanup path");
    }
    rmSync(checked, { recursive: true, force: true });
  }
});
