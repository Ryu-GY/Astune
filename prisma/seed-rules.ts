import type { PrismaClient } from "@prisma/client";
import { DEFAULT_INTERPRETATION_RULES, DEFAULT_RULE_VERSION } from "../src/lib/readings/fixtures/default-rules";
import { toPrismaRule } from "../src/lib/readings/repositories/prisma-rule-mapper";
import { publishInTransaction } from "../src/server/services/rule-publishing";

export async function seedDefaultRules(prisma: PrismaClient, adminUserId: string) {
  return prisma.$transaction(async tx => {
    const version = await tx.ruleVersion.upsert({
      where: { id: DEFAULT_RULE_VERSION.id }, update: {},
      create: {
        id: DEFAULT_RULE_VERSION.id, name: DEFAULT_RULE_VERSION.versionCode,
        description: DEFAULT_RULE_VERSION.note, createdById: adminUserId
      }
    });
    // Reruns preserve both edited drafts and all published/archived snapshots.
    if (version.status === "DRAFT") {
      for (const rule of DEFAULT_INTERPRETATION_RULES) {
        await tx.interpretationRule.upsert({
          where: { id: rule.id }, update: {}, create: toPrismaRule(rule)
        });
      }
      const published = await tx.ruleVersion.findFirst({ where: { status: "PUBLISHED" } });
      if (!published) await publishInTransaction(tx, version.id, adminUserId);
    }
    return tx.ruleVersion.findUniqueOrThrow({ where: { id: version.id } });
  }, { maxWait: 10000, timeout: 60000 });
}
