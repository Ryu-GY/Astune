import { PrismaClient, UserRole } from "@prisma/client";

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

  let version = await prisma.ruleVersion.findFirst({
    where: { name: "starter-v1" }
  });

  if (!version) {
    version = await prisma.ruleVersion.create({
      data: {
        name: "starter-v1",
        description: "기본 리딩 규칙",
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: admin.id
      }
    });
  }

  const existingRuleCount = await prisma.interpretationRule.count({
    where: { ruleVersionId: version.id }
  });

  const seedRules = [
    {
      constellationCode: "Ori",
      title: "개척형 별 리딩",
      keywordsCsv: "도전,직진,결단",
      generalText: "초기 개척과 실행력이 강한 흐름",
      loveText: "표현을 아끼지 않을수록 관계가 안정됩니다.",
      careerText: "새로운 프로젝트의 시작에서 강합니다.",
      moneyText: "충동 소비보다 목표 예산 관리가 중요합니다."
    },
    {
      constellationCode: "Lyr",
      title: "조율형 별 리딩",
      keywordsCsv: "균형,감각,표현",
      generalText: "감각과 표현, 조율 능력이 강한 흐름",
      loveText: "맞춰주기보다 원하는 기준을 먼저 세우세요.",
      careerText: "기획, 커뮤니케이션, 브랜딩 업무에 강합니다.",
      moneyText: "꾸준한 저축 습관이 잘 맞습니다."
    },
    {
      constellationCode: "Sco",
      title: "집중형 별 리딩",
      keywordsCsv: "몰입,집중,깊이",
      generalText: "깊게 파고드는 집중력이 강한 흐름",
      loveText: "신뢰가 분명한 관계가 오래 갑니다.",
      careerText: "리서치, 분석, 디버깅과 잘 맞습니다.",
      moneyText: "리스크를 줄이는 관리형 전략이 유리합니다."
    },
    {
      constellationCode: "Vir",
      title: "정리형 별 리딩",
      keywordsCsv: "정돈,관리,꾸준함",
      generalText: "구조화와 개선, 정리 능력이 강한 흐름",
      loveText: "지나친 기준은 관계를 지치게 할 수 있습니다.",
      careerText: "운영, QA, 데이터 정리에 강합니다.",
      moneyText: "지출 기록과 소액 분산이 장기적으로 유리합니다."
    }
  ];

  if (existingRuleCount === 0) {
    await prisma.interpretationRule.createMany({
      data: seedRules.map((rule) => ({
        ...rule,
        ruleVersionId: version.id
      }))
    });
  }

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
