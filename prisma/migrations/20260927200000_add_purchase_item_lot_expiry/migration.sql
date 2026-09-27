-- Traçabilité par lot et suivi de péremption, renseignés à l'approvisionnement.
ALTER TABLE "PurchaseItem" ADD COLUMN "lotNumber" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN "expiryDate" TIMESTAMP(3);
