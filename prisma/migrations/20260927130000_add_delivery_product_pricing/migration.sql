-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "productId" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "pricePerBottle" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
