"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";

export type SearchResult = {
  category: string;
  id: string;
  label: string;
  sublabel: string;
  href: string;
};

// Recherche globale transversale : client, fournisseur, produit, vente,
// achat, livraison, en un seul appel — pour retrouver un dossier par nom,
// téléphone, code ou numéro sans savoir dans quel module il se trouve.
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const check = await requireCompanyUser();
  if ("error" in check) return [];
  const { companyId } = check;

  const q = query.trim();
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };

  const [customers, suppliers, products, sales, purchases, deliveries] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId, OR: [{ name: contains }, { code: contains }, { phone: contains }] },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: { companyId, OR: [{ name: contains }, { code: contains }, { phone: contains }] },
      take: 5,
    }),
    prisma.product.findMany({
      where: { companyId, OR: [{ name: contains }, { barcode: contains }, { reference: contains }] },
      take: 5,
    }),
    prisma.sale.findMany({
      where: { companyId, number: contains },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.purchase.findMany({
      where: { companyId, number: contains },
      take: 5,
      include: { supplier: { select: { name: true } } },
    }),
    prisma.delivery.findMany({
      where: { companyId, number: contains },
      take: 5,
    }),
  ]);

  const results: SearchResult[] = [];
  for (const c of customers) {
    results.push({ category: "Client", id: c.id, label: c.name, sublabel: c.code || c.phone || "", href: `/clients/${c.id}` });
  }
  for (const s of suppliers) {
    results.push({ category: "Fournisseur", id: s.id, label: s.name, sublabel: s.code || s.phone || "", href: `/fournisseurs/${s.id}` });
  }
  for (const p of products) {
    results.push({ category: "Produit", id: p.id, label: p.name, sublabel: p.reference || p.barcode || "", href: "/produits" });
  }
  for (const s of sales) {
    results.push({
      category: "Vente",
      id: s.id,
      label: s.number,
      sublabel: s.customer?.name || "Client comptant",
      href: "/ventes?tab=historique",
    });
  }
  for (const p of purchases) {
    results.push({ category: "Achat", id: p.id, label: p.number, sublabel: p.supplier.name, href: "/achats" });
  }
  for (const d of deliveries) {
    results.push({ category: "Livraison", id: d.id, label: d.number, sublabel: d.destination, href: "/livraison-clients" });
  }

  return results;
}
