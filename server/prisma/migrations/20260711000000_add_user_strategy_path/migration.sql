-- CreateEnum
CREATE TYPE "StrategyPath" AS ENUM ('QUICK', 'MEDIUM', 'LONG');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "strategyPath" "StrategyPath",
  ADD COLUMN "pathChosenAt" TIMESTAMP(3);
