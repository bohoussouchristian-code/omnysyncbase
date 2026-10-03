-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- Backfill: each existing single-product delivery becomes one DeliveryItem row.
INSERT INTO "DeliveryItem" ("id", "deliveryId", "productId", "quantity", "companyId")
SELECT gen_random_uuid()::text, "id", "productId", COALESCE("quantity", 0), "companyId"
FROM "Delivery"
WHERE "productId" IS NOT NULL;

-- AlterTable: Delivery no longer carries a single product/quantity directly.
ALTER TABLE "Delivery" DROP COLUMN "productId";
ALTER TABLE "Delivery" DROP COLUMN "quantity";

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");

-- DropTable: Solde général's base is now synchronized live from Trésorerie
-- bank account balances instead of a manually-entered, separately-stored value.
DROP TABLE "GeneralBalance";
