-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BirthProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "birthAtLocal" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "locationName" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BirthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "birthProfileId" TEXT,
    "displayName" TEXT,
    "birthAtLocal" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "locationName" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "zenithStarHipId" INTEGER NOT NULL,
    "zenithStarName" TEXT NOT NULL,
    "constellationCode" TEXT NOT NULL,
    "constellationName" TEXT NOT NULL,
    "zenithDistanceDeg" REAL NOT NULL,
    "magnitude" REAL NOT NULL,
    "summary" TEXT NOT NULL,
    "keywordsCsv" TEXT NOT NULL,
    "loveText" TEXT NOT NULL,
    "careerText" TEXT NOT NULL,
    "moneyText" TEXT NOT NULL,
    "astronomyMetaJson" TEXT NOT NULL,
    "interpretationMetaJson" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "engineName" TEXT NOT NULL,
    "astroSourceLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reading_birthProfileId_fkey" FOREIGN KEY ("birthProfileId") REFERENCES "BirthProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterpretationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleVersionId" TEXT NOT NULL,
    "constellationCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keywordsCsv" TEXT NOT NULL,
    "generalText" TEXT NOT NULL,
    "loveText" TEXT NOT NULL,
    "careerText" TEXT NOT NULL,
    "moneyText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterpretationRule_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BirthProfile_userId_createdAt_idx" ON "BirthProfile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Reading_userId_createdAt_idx" ON "Reading"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Reading_birthProfileId_idx" ON "Reading"("birthProfileId");

-- CreateIndex
CREATE INDEX "RuleVersion_status_publishedAt_idx" ON "RuleVersion"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterpretationRule_ruleVersionId_constellationCode_key" ON "InterpretationRule"("ruleVersionId", "constellationCode");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");
