-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: les commandes déjà créées avant l'introduction du brouillon
-- avaient déjà leur paiement/solde fournisseur enregistrés immédiatement à la
-- création. On les marque comme validées dès maintenant pour ne pas les
-- traiter comme des brouillons (et éviter un double enregistrement du
-- paiement le jour où quelqu'un cliquerait "Valider" dessus).
UPDATE "Purchase" SET "validatedAt" = "date" WHERE "validatedAt" IS NULL;
