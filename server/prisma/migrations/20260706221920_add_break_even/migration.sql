-- CreateTable
CREATE TABLE "BreakEven" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fixedCosts" DOUBLE PRECISION NOT NULL,
    "variableCostPerUnit" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "currentRevenue" DOUBLE PRECISION,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakEven_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreakEven_companyId_idx" ON "BreakEven"("companyId");

-- AddForeignKey
ALTER TABLE "BreakEven" ADD CONSTRAINT "BreakEven_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
