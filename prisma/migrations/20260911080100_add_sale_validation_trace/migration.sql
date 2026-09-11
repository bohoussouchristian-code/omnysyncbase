-- AlterTable
ALTER TABLE "Sale" ALTER COLUMN "status" SET DEFAULT 'EN_ATTENTE';
ALTER TABLE "Sale" ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
