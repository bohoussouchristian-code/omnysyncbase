// Intégration FNE (Facture Normalisée Électronique — DGI Côte d'Ivoire).
//
// Implémenté à partir de la documentation officielle de la DGI
// ("PROCEDURE D'INTERFACAGE DES ENTREPRISES PAR API", mai 2025,
// https://www.fne.dgi.gouv.ci/documents/FNE-procedureapi.pdf).
//
// Chaque entreprise de la plateforme renseigne ses propres identifiants FNE
// (NCC + clé API, voir Company.fneNcc / fneApiKey / fneEnabled / fneBaseUrl
// et la page /entreprise) : le stockage multi-tenant est en place et
// submitSaleToFne() ci-dessous effectue le véritable appel à l'API de la DGI.
//
// Avant de brancher l'appel automatique à la validation d'une vente
// (src/lib/actions/sales.ts, validateSale), il reste à décider quel taux de
// TVA appliquer par article — le paramètre `taxes` est obligatoire pour la
// DGI (TVA 18%, TVAB 9%, TVAC/TVAD 0%) et OSB ne le suit pas encore par
// produit. Voir le paramètre `items[].taxes` de FneInvoiceInput ci-dessous.

// URL de l'environnement de test DGI, valable pour toutes les entreprises
// tant qu'elles n'ont pas reçu leur URL de production (transmise par la DGI
// après validation de spécimens de factures, voir Company.fneBaseUrl).
const FNE_TEST_BASE_URL = "http://54.247.95.108/ws";

export type FneCompanyConfig = {
  fneNcc: string | null;
  fneApiKey: string | null;
  fneEnabled: boolean;
  fneBaseUrl: string | null;
};

export function isFneConfigured(company: FneCompanyConfig): boolean {
  return Boolean(company.fneEnabled && company.fneNcc && company.fneApiKey);
}

// Valeurs exactement telles que documentées par la DGI (Annexe 1 : Lexique).
export type FneInvoiceType = "sale" | "purchase";
export type FnePaymentMethod = "cash" | "card" | "check" | "mobile-money" | "transfer" | "deferred";
export type FneTemplate = "B2B" | "B2F" | "B2G" | "B2C";
export type FneTaxCode = "TVA" | "TVAB" | "TVAC" | "TVAD";

export type FneItem = {
  description: string;
  quantity: number;
  amount: number; // Prix unitaire HT
  taxes: FneTaxCode[];
  reference?: string;
  measurementUnit?: string;
  discount?: number;
  customTaxes?: { name: string; amount: number }[];
};

export type FneInvoiceInput = {
  invoiceType: FneInvoiceType;
  paymentMethod: FnePaymentMethod;
  template: FneTemplate;
  isRne: boolean;
  rne?: string; // Obligatoire si isRne est vrai
  clientNcc?: string; // Obligatoire si template est B2B
  clientCompanyName: string;
  clientPhone: string;
  clientEmail: string;
  clientSellerName?: string;
  pointOfSale: string;
  establishment: string;
  commercialMessage?: string;
  footer?: string;
  foreignCurrency?: string;
  foreignCurrencyRate?: number;
  items: FneItem[];
  discount?: number;
};

export type FneSubmissionResult =
  | { ok: true; reference: string; token: string; balanceSticker: number; warning: boolean }
  | { ok: false; reason: string; statusCode?: number };

// Certifie une facture de vente (ou un bordereau d'achat agricole) auprès de
// la plateforme FNE — POST $url/external/invoices/sign, tel que documenté.
export async function submitSaleToFne(
  company: FneCompanyConfig,
  input: FneInvoiceInput
): Promise<FneSubmissionResult> {
  if (!isFneConfigured(company)) {
    return { ok: false, reason: "FNE non configurée ou non activée pour cette entreprise." };
  }

  const baseUrl = company.fneBaseUrl || FNE_TEST_BASE_URL;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/external/invoices/sign`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${company.fneApiKey}`,
      },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, reason: "Impossible de joindre la plateforme FNE (réseau)." };
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "Réponse FNE illisible.", statusCode: res.status };
  }

  if (!res.ok) {
    const message = typeof body.message === "string" ? body.message : "Erreur FNE inconnue.";
    return { ok: false, reason: message, statusCode: res.status };
  }

  return {
    ok: true,
    reference: String(body.reference ?? ""),
    token: String(body.token ?? ""),
    balanceSticker: Number(body.balance_sticker ?? 0),
    warning: Boolean(body.warning),
  };
}

// Certifie une facture d'avoir (retour) liée à une facture déjà certifiée —
// POST $url/external/invoices/{id}/refund. `invoiceId` est l'id (pas la
// référence) renvoyé dans `invoice.id` par submitSaleToFne à la certification
// d'origine, et chaque `itemId` est l'id renvoyé dans `invoice.items[].id`.
export async function submitRefundToFne(
  company: FneCompanyConfig,
  invoiceId: string,
  items: { id: string; quantity: number }[]
): Promise<FneSubmissionResult> {
  if (!isFneConfigured(company)) {
    return { ok: false, reason: "FNE non configurée ou non activée pour cette entreprise." };
  }

  const baseUrl = company.fneBaseUrl || FNE_TEST_BASE_URL;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/external/invoices/${invoiceId}/refund`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${company.fneApiKey}`,
      },
      body: JSON.stringify({ items }),
    });
  } catch {
    return { ok: false, reason: "Impossible de joindre la plateforme FNE (réseau)." };
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "Réponse FNE illisible.", statusCode: res.status };
  }

  if (!res.ok) {
    const message = typeof body.message === "string" ? body.message : "Erreur FNE inconnue.";
    return { ok: false, reason: message, statusCode: res.status };
  }

  return {
    ok: true,
    reference: String(body.reference ?? ""),
    token: String(body.token ?? ""),
    balanceSticker: Number(body.balance_sticker ?? 0),
    warning: Boolean(body.warning),
  };
}
