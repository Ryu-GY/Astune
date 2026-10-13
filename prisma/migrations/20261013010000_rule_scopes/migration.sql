-- Preserve legacy rules, including the old "default" global fallback.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE "new_InterpretationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleVersionId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'constellation',
    "constellationCode" TEXT,
    "starId" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "title" TEXT NOT NULL,
    "keywordsCsv" TEXT NOT NULL,
    "generalText" TEXT NOT NULL,
    "personalityText" TEXT NOT NULL DEFAULT '',
    "loveText" TEXT NOT NULL,
    "careerText" TEXT NOT NULL,
    "moneyText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterpretationRule_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterpretationRule_scope_check" CHECK (
      ("scopeType" = 'global' AND "constellationCode" IS NULL AND "starId" IS NULL) OR
      ("scopeType" = 'constellation' AND "starId" IS NULL AND "constellationCode" IS NOT NULL
        AND "constellationCode" GLOB '[A-Z][A-Za-z][A-Za-z]') OR
      ("scopeType" = 'star' AND "constellationCode" IS NULL AND "starId" IS NOT NULL
        AND typeof("starId") = 'integer' AND "starId" > 0)
    ),
    CONSTRAINT "InterpretationRule_priority_check" CHECK (
      typeof("priority") = 'integer' AND "priority" BETWEEN -32768 AND 32767
    )
);

INSERT INTO "new_InterpretationRule" (
  "id", "ruleVersionId", "scopeType", "constellationCode", "priority", "title",
  "keywordsCsv", "generalText", "loveText", "careerText", "moneyText", "createdAt", "updatedAt"
)
SELECT "id", "ruleVersionId",
  CASE WHEN "constellationCode" = 'default' THEN 'global' ELSE 'constellation' END,
  CASE WHEN "constellationCode" = 'default' THEN NULL ELSE "constellationCode" END,
  CASE WHEN "constellationCode" = 'default' THEN 10 ELSE 100 END,
  "title", "keywordsCsv", "generalText", "loveText", "careerText", "moneyText", "createdAt", "updatedAt"
FROM "InterpretationRule";

DROP TABLE "InterpretationRule";
ALTER TABLE "new_InterpretationRule" RENAME TO "InterpretationRule";
CREATE INDEX "InterpretationRule_ruleVersionId_scopeType_priority_idx"
  ON "InterpretationRule"("ruleVersionId", "scopeType", "priority");

-- Keep the version the old reader would have selected; retain older snapshots as archived.
UPDATE "RuleVersion" SET "status" = 'ARCHIVED'
WHERE "status" = 'PUBLISHED' AND "id" NOT IN (
  SELECT "id" FROM "RuleVersion" WHERE "status" = 'PUBLISHED'
  ORDER BY "publishedAt" DESC, "id" ASC LIMIT 1
);

-- Prisma 6 cannot express this partial index or the CHECK constraints above.
-- Keep them in SQL migrations; do not replace migrations with prisma db push.
CREATE UNIQUE INDEX "RuleVersion_one_published" ON "RuleVersion"("status")
  WHERE "status" = 'PUBLISHED';

COMMIT;
PRAGMA foreign_keys=ON;
