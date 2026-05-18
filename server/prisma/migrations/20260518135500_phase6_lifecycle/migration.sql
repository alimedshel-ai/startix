-- Phase 6: strategic lifecycle additions.

CREATE TABLE "StrategicArtifact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategicArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StrategicArtifact_companyId_type_key" ON "StrategicArtifact"("companyId", "type");
CREATE INDEX "StrategicArtifact_companyId_idx" ON "StrategicArtifact"("companyId");

ALTER TABLE "StrategicArtifact" ADD CONSTRAINT "StrategicArtifact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reviewId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Correction_companyId_idx" ON "Correction"("companyId");
CREATE INDEX "Correction_reviewId_idx" ON "Correction"("reviewId");

ALTER TABLE "Correction" ADD CONSTRAINT "Correction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
