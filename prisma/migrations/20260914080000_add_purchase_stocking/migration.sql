-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "stockedAt" TIMESTAMP(3);
ALTER TABLE "Purchase" ADD COLUMN "stockedById" TEXT;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_stockedById_fkey" FOREIGN KEY ("stockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Les commandes déjà reçues avant ce changement avaient déjà leur stock crédité
-- au moment de la réception (ancien modèle) : on les marque rétroactivement
-- comme déjà approvisionnées pour ne pas doubler le stock si quelqu'un ouvre
-- le nouveau sous-module Approvisionnement sur ces commandes.
UPDATE "Purchase" SET "stockedAt" = "receivedAt", "stockedById" = "receivedById" WHERE "status" = 'RECUE' AND "stockedAt" IS NULL;
