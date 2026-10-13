import { prisma } from "@/lib/db/prisma";

export async function getPublishedRuleVersion() {
  return prisma.ruleVersion.findFirst({
    where: { status: "PUBLISHED" },
    include: { rules: true },
    orderBy: { publishedAt: "desc" }
  });
}
