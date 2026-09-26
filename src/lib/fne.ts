// Intégration FNE (Facture Normalisée Électronique — DGI Côte d'Ivoire).
//
// Chaque entreprise de la plateforme peut renseigner ses propres identifiants
// FNE (NCC + clé API, voir Company.fneNcc / fneApiKey / fneEnabled et la page
// /entreprise) : le stockage multi-tenant est en place. Ce qui manque encore
// est l'appel réel à l'API de la DGI (endpoint, format de la requête et de la
// réponse — QR code, référence FNE à imprimer sur le reçu...), qui n'a pas pu
// être implémenté faute de documentation/accès DGI au moment de l'écriture.
//
// Une fois ces éléments obtenus, brancher ici l'appel HTTP réel et faire
// invoquer submitSaleToFne(...) au moment de la validation d'une vente
// (src/lib/actions/sales.ts, validateSale) pour les entreprises où
// company.fneEnabled est vrai.

export type FneCompanyConfig = {
  fneNcc: string | null;
  fneApiKey: string | null;
  fneEnabled: boolean;
};

export function isFneConfigured(company: FneCompanyConfig): boolean {
  return Boolean(company.fneEnabled && company.fneNcc && company.fneApiKey);
}

export type FneSubmissionResult =
  | { ok: true; fneReference: string }
  | { ok: false; reason: string };

// Volontairement non implémenté : voir la note en tête de fichier.
export async function submitSaleToFne(
  company: FneCompanyConfig,
  sale: { number: string; totalAmount: number }
): Promise<FneSubmissionResult> {
  return {
    ok: false,
    reason: `Intégration FNE non encore branchée à l'API de la DGI (vente ${sale.number}, NCC ${company.fneNcc ?? "non renseigné"}).`,
  };
}
