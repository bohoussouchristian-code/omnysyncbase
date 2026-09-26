-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('EN_ATTENTE', 'LIVREE', 'ANNULEE');

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "saleId" TEXT,
    "customerId" TEXT,
    "destination" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "fee" DOUBLE PRECISION NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "userId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_companyId_number_key" ON "Delivery"("companyId", "number");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
