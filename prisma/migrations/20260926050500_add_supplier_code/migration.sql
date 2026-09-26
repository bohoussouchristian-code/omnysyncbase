-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_code_key" ON "Supplier"("companyId", "code");
