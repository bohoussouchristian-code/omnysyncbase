-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "isGeneral" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedById" TEXT;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: assigne un Depot General par entreprise deja existante
-- (le plus ancien entrepot actif de type ENTREPOT, sinon le plus ancien depot actif).
UPDATE "Warehouse" w
SET "isGeneral" = true
FROM (
  SELECT DISTINCT ON ("companyId") id
  FROM "Warehouse"
  WHERE "active" = true
  ORDER BY "companyId", (CASE WHEN "type" = 'ENTREPOT' THEN 0 ELSE 1 END), "createdAt" ASC
) AS chosen
WHERE w.id = chosen.id;
