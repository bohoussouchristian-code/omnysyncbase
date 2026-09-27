-- Solde général fictif : base de départ + cumul auto ventes encaissées − dépenses.
CREATE TABLE "GeneralBalance" (
    "id" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "GeneralBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeneralBalance_companyId_key" ON "GeneralBalance"("companyId");

ALTER TABLE "GeneralBalance" ADD CONSTRAINT "GeneralBalance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneralBalance" ADD CONSTRAINT "GeneralBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
