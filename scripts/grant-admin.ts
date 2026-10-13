import { PrismaClient } from "@prisma/client";
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:grant -- <existing Google account email>");
  const db = new PrismaClient();
  try {
    const user = await db.user.findUnique({ where: { email }, include: { accounts: { where: { providerId: "google" } } } });
    if (!user?.accounts.length) throw new Error("Sign in with Google first. The account must already exist.");
    await db.$transaction(async tx => {
      await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      await tx.adminAuditLog.create({ data: { adminUserId: user.id, action: "ADMIN_BOOTSTRAP", targetType: "user", targetId: user.id,
        payloadJson: JSON.stringify({ outcome: "SUCCESS", source: "local-operator-cli", before: { role: user.role }, after: { role: "ADMIN" } }) } });
    });
    console.log("Administrator role granted to the existing account.");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Failed"); process.exitCode = 1; });
