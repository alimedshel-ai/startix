-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('lead', 'due_diligence', 'term_sheet', 'closed_won', 'closed_lost');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "investorUserId" TEXT NOT NULL,
    "targetCompanyName" TEXT NOT NULL,
    "sector" TEXT,
    "stage" TEXT,
    "valuation" DECIMAL(65,30),
    "status" "DealStatus" NOT NULL DEFAULT 'lead',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_investorUserId_idx" ON "Deal"("investorUserId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_investorUserId_fkey" FOREIGN KEY ("investorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
