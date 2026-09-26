-- CreateTable
CREATE TABLE "ExpenseEnvelope" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ExpenseEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEnvelopeTopUp" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ExpenseEnvelopeTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseVoucher" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "vehiclePlate" TEXT,
    "notes" TEXT,
    "expenseId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ExpenseVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEnvelope_companyId_category_key" ON "ExpenseEnvelope"("companyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseVoucher_expenseId_key" ON "ExpenseVoucher"("expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseEnvelope" ADD CONSTRAINT "ExpenseEnvelope_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEnvelopeTopUp" ADD CONSTRAINT "ExpenseEnvelopeTopUp_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "ExpenseEnvelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEnvelopeTopUp" ADD CONSTRAINT "ExpenseEnvelopeTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEnvelopeTopUp" ADD CONSTRAINT "ExpenseEnvelopeTopUp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "ExpenseEnvelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
