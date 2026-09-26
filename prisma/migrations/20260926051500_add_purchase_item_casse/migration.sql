-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "receivedQuantity" DOUBLE PRECISION,
ADD COLUMN     "brokenQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
