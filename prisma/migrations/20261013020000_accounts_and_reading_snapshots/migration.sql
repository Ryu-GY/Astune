ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "image" TEXT;
ALTER TABLE "BirthProfile" ADD COLUMN "displayName" TEXT;
ALTER TABLE "BirthProfile" ADD COLUMN "dstFold" INTEGER CHECK ("dstFold" IS NULL OR "dstFold" IN (0, 1));
ALTER TABLE "BirthProfile" ADD COLUMN "maxMagnitude" REAL NOT NULL DEFAULT 2;
ALTER TABLE "Reading" ADD COLUMN "dstFold" INTEGER CHECK ("dstFold" IS NULL OR "dstFold" IN (0, 1));
ALTER TABLE "Reading" ADD COLUMN "maxMagnitude" REAL NOT NULL DEFAULT 2;
ALTER TABLE "Reading" ADD COLUMN "birthTimeUnknown" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reading" ADD COLUMN "inputSnapshotJson" TEXT;
ALTER TABLE "Reading" ADD COLUMN "previewSnapshotJson" TEXT;

CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY, "token" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL, "ipAddress" TEXT, "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE TABLE "Account" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT,
  "accessTokenExpiresAt" DATETIME, "refreshTokenExpiresAt" DATETIME, "scope" TEXT, "password" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE TABLE "Verification" (
  "id" TEXT NOT NULL PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
CREATE TABLE "RateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL, "count" INTEGER NOT NULL, "lastRequest" BIGINT NOT NULL
);
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
