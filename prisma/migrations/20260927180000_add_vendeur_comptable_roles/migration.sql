-- Ajoute deux rôles : VENDEUR (vendeur/commercial, rattaché à un dépôt comme
-- un caissier) et COMPTABLE (accès en lecture aux rapports/trésorerie, plus
-- pointage/rapprochement bancaire).
ALTER TYPE "Role" ADD VALUE 'VENDEUR';
ALTER TYPE "Role" ADD VALUE 'COMPTABLE';
