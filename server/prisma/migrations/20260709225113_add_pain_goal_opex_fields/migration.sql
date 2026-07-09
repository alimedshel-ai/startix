-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "opex" JSONB,
ADD COLUMN     "subsector" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pains" TEXT[] DEFAULT ARRAY[]::TEXT[];
