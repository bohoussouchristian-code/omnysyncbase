import type { Role, CustomerType, MovementType, PaymentMethod } from "@prisma/client";

// Déconnexion automatique après ce délai d'inactivité (aucune requête reçue).
// Le middleware prolonge la session à chaque requête tant que l'utilisateur
// est actif ; sans activité, le cookie expire et l'utilisateur est déconnecté.
export const SESSION_IDLE_MINUTES = 30;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  GERANT: "Gérant",
  CAISSIER: "Caissier",
  MAGASINIER: "Magasinier",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ENTREE: "Entrée",
  SORTIE: "Sortie",
  TRANSFERT_ENTREE: "Transfert (reçu)",
  TRANSFERT_SORTIE: "Transfert (envoyé)",
  AJUSTEMENT: "Ajustement",
  VENTE: "Vente",
  ACHAT: "Achat",
  RETOUR_VENTE: "Retour client",
  RETOUR_ACHAT: "Retour fournisseur",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  PARTICULIER: "Particulier",
  PROFESSIONNEL: "Professionnel",
  REVENDEUR: "Revendeur",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  VIREMENT: "Virement",
  CREDIT: "Crédit",
  MIXTE: "Mixte",
};

// Programme de fidélité : 1 point gagné par tranche de 100 FCFA d'achat,
// 1 point = 10 FCFA de réduction lors de l'utilisation (cashback ~10%).
export const LOYALTY_FCFA_PER_POINT_EARNED = 100;
export const LOYALTY_POINT_VALUE_FCFA = 10;

export const EXPENSE_CATEGORIES = [
  "Loyer",
  "Transport",
  "Électricité / Eau",
  "Salaires",
  "Fournitures",
  "Entretien / Réparation",
  "Communication",
  "Impôts et taxes",
  "Autre",
];
