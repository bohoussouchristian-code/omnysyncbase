import type { Role } from "@prisma/client";

// Permissions "métier" déléguables individuellement, au-delà du rôle. Volontairement
// exclu de cette liste : tout ce qui touche à la gestion des utilisateurs, de
// l'entreprise/FNE et des dépôts — ces trois-là restent strictement liés au rôle
// ADMIN (voir src/lib/actions/users.ts, company.ts, warehouses.ts) pour qu'aucune
// dérogation ne puisse permettre à un compte non-administrateur de s'accorder plus
// de droits que son rôle ne le permet déjà (pas d'auto-élévation de privilèges).
export const PERMISSION_KEYS = [
  "tiers.gerer",
  "produits.gerer",
  "prestations.gerer",
  "ventes.annuler",
  "depenses.annuler",
  "budgets.gerer",
  "livraisons.gerer",
  "livraisons.annuler",
  "banque.gerer",
  "banque.rapprocher",
  "rapports.voir",
  "caisses.gerer",
  "employes.gerer",
  "paie.gerer",
  "proformas.supprimer",
  "audit.voir",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "tiers.gerer": "Créer/modifier clients & fournisseurs",
  "produits.gerer": "Créer/modifier catalogue (produits, catégories, unités)",
  "prestations.gerer": "Créer/modifier les prestations",
  "ventes.annuler": "Annuler une vente",
  "depenses.annuler": "Annuler une dépense",
  "budgets.gerer": "Réapprovisionner/activer une caisse de dépense",
  "livraisons.gerer": "Créer une livraison, l'assigner, encaisser son paiement",
  "livraisons.annuler": "Annuler une livraison",
  "banque.gerer": "Créer un compte bancaire, saisir un mouvement",
  "banque.rapprocher": "Pointer les mouvements et enregistrer un rapprochement",
  "rapports.voir": "Voir les rapports et comptes bancaires (lecture)",
  "caisses.gerer": "Voir la gestion des caisses & dépôts (toutes les sessions)",
  "employes.gerer": "Créer/modifier les fiches employés",
  "paie.gerer": "Créer/modifier les bulletins de salaire",
  "proformas.supprimer": "Supprimer un devis (proforma)",
  "audit.voir": "Consulter le journal d'audit (Sécurité)",
};

export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: "Tiers & catalogue", keys: ["tiers.gerer", "produits.gerer", "prestations.gerer"] },
  { label: "Annulations", keys: ["ventes.annuler", "depenses.annuler", "livraisons.annuler"] },
  { label: "Livraisons", keys: ["livraisons.gerer"] },
  { label: "Finances", keys: ["budgets.gerer", "banque.gerer", "banque.rapprocher", "caisses.gerer"] },
  { label: "Rapports & audit", keys: ["rapports.voir", "audit.voir"] },
  { label: "Ressources humaines", keys: ["employes.gerer", "paie.gerer"] },
  { label: "Ventes", keys: ["proformas.supprimer"] },
];

// Comportement par défaut de chaque rôle, tel qu'il existait avant l'introduction
// des dérogations individuelles — reproduit exactement les anciens contrôles
// `role === "ADMIN"` / `role === "ADMIN" || role === "GERANT"` etc. dispersés dans
// les actions serveur, pour qu'aucun utilisateur existant ne change de comportement
// tant qu'un administrateur ne lui accorde/retire pas explicitement une permission.
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, PermissionKey[]> = {
  ADMIN: [...PERMISSION_KEYS],
  GERANT: [
    "budgets.gerer",
    "livraisons.gerer",
    "livraisons.annuler",
    "banque.gerer",
    "banque.rapprocher",
    "rapports.voir",
    "caisses.gerer",
  ],
  CAISSIER: [],
  MAGASINIER: [],
  VENDEUR: [],
  COMPTABLE: ["banque.rapprocher", "rapports.voir"],
};

export function roleHasPermission(role: Role, key: PermissionKey): boolean {
  return ROLE_DEFAULT_PERMISSIONS[role].includes(key);
}
