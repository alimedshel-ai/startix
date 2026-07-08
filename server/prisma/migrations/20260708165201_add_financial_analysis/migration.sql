-- CreateTable
CREATE TABLE "DupontAnalysis" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "netMargin" DOUBLE PRECISION NOT NULL,
    "assetTurnover" DOUBLE PRECISION NOT NULL,
    "equityMultiplier" DOUBLE PRECISION NOT NULL,
    "roe" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DupontAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonteCarloRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "iterations" INTEGER NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonteCarloRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DupontAnalysis_companyId_idx" ON "DupontAnalysis"("companyId");

-- CreateIndex
CREATE INDEX "MonteCarloRun_companyId_idx" ON "MonteCarloRun"("companyId");

-- AddForeignKey
ALTER TABLE "DupontAnalysis" ADD CONSTRAINT "DupontAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonteCarloRun" ADD CONSTRAINT "MonteCarloRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
