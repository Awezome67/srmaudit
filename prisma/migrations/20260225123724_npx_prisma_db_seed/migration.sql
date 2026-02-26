/*
  Warnings:

  - Added the required column `controlId` to the `Finding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `severity` to the `Finding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Finding` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Evidence" ("assetId", "controlId", "fileName", "filePath", "id", "mimeType", "uploadedAt") SELECT "assetId", "controlId", "fileName", "filePath", "id", "mimeType", "uploadedAt" FROM "Evidence";
DROP TABLE "Evidence";
ALTER TABLE "new_Evidence" RENAME TO "Evidence";
CREATE INDEX "Evidence_assetId_idx" ON "Evidence"("assetId");
CREATE INDEX "Evidence_controlId_idx" ON "Evidence"("controlId");
CREATE TABLE "new_Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "rootCause" TEXT,
    "recommendation" TEXT NOT NULL,
    "riskTreatment" TEXT NOT NULL DEFAULT 'MITIGATE',
    "owner" TEXT,
    "dueDate" DATETIME,
    "evidenceRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Finding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Finding_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Finding" ("assetId", "createdAt", "id", "issue", "recommendation", "risk") SELECT "assetId", "createdAt", "id", "issue", "recommendation", "risk" FROM "Finding";
DROP TABLE "Finding";
ALTER TABLE "new_Finding" RENAME TO "Finding";
CREATE INDEX "Finding_assetId_idx" ON "Finding"("assetId");
CREATE INDEX "Finding_controlId_idx" ON "Finding"("controlId");
CREATE UNIQUE INDEX "Finding_assetId_controlId_issue_key" ON "Finding"("assetId", "controlId", "issue");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
