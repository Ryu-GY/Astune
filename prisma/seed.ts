import { PrismaClient, UserRole } from "@prisma/client";
import { seedDefaultRules } from "./seed-rules";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@astune.local" },
    update: { role: UserRole.ADMIN, name: "Astune Admin" },
    create: {
      email: "admin@astune.local",
      name: "Astune Admin",
      role: UserRole.ADMIN
    }
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "user@astune.local" },
    update: { role: UserRole.USER, name: "Demo User" },
    create: {
      email: "user@astune.local",
      name: "Demo User",
      role: UserRole.USER
    }
  });

  const version = await seedDefaultRules(prisma, admin.id);

  console.log("Seed complete", {
    adminId: admin.id,
    demoUserId: demoUser.id,
    ruleVersionId: version.id
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
