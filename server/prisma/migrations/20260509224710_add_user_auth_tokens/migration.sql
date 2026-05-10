-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "emailVerificationToken" TEXT,
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetToken" TEXT,
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
