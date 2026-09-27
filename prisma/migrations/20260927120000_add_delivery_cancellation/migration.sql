-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Delivery" ADD COLUMN "cancelledById" TEXT;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
