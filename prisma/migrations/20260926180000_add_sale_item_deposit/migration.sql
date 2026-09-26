-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "depositIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
