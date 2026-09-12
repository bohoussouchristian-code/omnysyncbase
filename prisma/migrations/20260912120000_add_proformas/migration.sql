-- CreateTable
CREATE TABLE "Proforma" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "validUntil" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Proforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProformaItem" (
    "id" TEXT NOT NULL,
    "proformaId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ProformaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proforma_companyId_number_key" ON "Proforma"("companyId", "number");

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
