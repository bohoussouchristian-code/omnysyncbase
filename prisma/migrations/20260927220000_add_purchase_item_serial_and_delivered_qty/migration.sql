-- Observation à la réception (bon de livraison), distincte du comptage
-- définitif à l'approvisionnement — plus le numéro de série.
ALTER TABLE "PurchaseItem" ADD COLUMN "deliveredQuantity" DOUBLE PRECISION;
ALTER TABLE "PurchaseItem" ADD COLUMN "deliveredBrokenQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseItem" ADD COLUMN "serialNumber" TEXT;
