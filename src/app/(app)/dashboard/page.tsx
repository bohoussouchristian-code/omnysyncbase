import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { getEffectivePermissions } from "@/lib/actions/permissions";
import Link from "next/link";
import {
  ShoppingCart,
  Wallet,
  ClipboardList,
  Boxes,
  Scale,
  UserCog,
  AlertTriangle,
  Send,
  Ban,
  Landmark,
  type LucideIcon,
} from "lucide-react";

type ModuleLink = { href: string; label: string };
type Module = { title: string; acronym: string; icon: LucideIcon; links: ModuleLink[] };

// Le tableau de bord reste un pur hub de navigation (alertes + accès rapide
// aux modules) — les indicateurs chiffrés (chiffre d'affaires, marge, valeur
// du stock...) vivent exclusivement dans Statistiques (voir
// src/app/(app)/statistiques/page.tsx), pour ne pas les afficher en double.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const permissions = await getEffectivePermissions(user);
  const canManageCashPoints = permissions.has("caisses.gerer");
  const canSeeReports = permissions.has("rapports.voir");
  const canSeeHR = permissions.has("employes.gerer") || permissions.has("paie.gerer");
  const canSeeCancellations =
    permissions.has("ventes.annuler") || permissions.has("depenses.annuler") || permissions.has("livraisons.annuler");

  const [warehousesCount, products, pendingDeliveries, unreimbursedAdvances] = await Promise.all([
    prisma.warehouse.count({ where: { active: true, companyId } }),
    prisma.product.findMany({ where: { active: true, companyId }, include: { stocks: true } }),
    prisma.delivery.count({ where: { companyId, status: "EN_ATTENTE" } }),
    prisma.cashAdvance.count({ where: { session: { companyId }, reimbursedAt: null } }),
  ]);

  const lowStockCount = products.filter((p) => {
    const qty = p.stocks.reduce((s, st) => s + st.quantity, 0);
    return p.reorderLevel > 0 && qty <= p.reorderLevel;
  }).length;

  const modules: Module[] = [
    {
      title: "Tiers",
      acronym: "TRS",
      icon: UserCog,
      links: [
        { href: "/clients", label: "Clients" },
        { href: "/fournisseurs", label: "Fournisseurs" },
      ],
    },
    {
      title: "Catalogue & référentiel",
      acronym: "CAT",
      icon: Boxes,
      links: [
        { href: "/produits", label: "Configuration des produits" },
        ...(permissions.has("produits.gerer") ? [{ href: "/categories", label: "Catégories & unités" }] : []),
        { href: "/prestations", label: "Prestations" },
      ],
    },
    {
      title: "Ventes & facturation",
      acronym: "VTE",
      icon: ShoppingCart,
      links: [
        { href: "/ventes", label: "Vente du jour" },
        { href: "/ventes/historique", label: "Historique des ventes" },
        { href: "/caisse-ventes", label: "Caisse" },
        { href: "/proformas", label: "Proformas" },
      ],
    },
    {
      title: "Achats & approvisionnement",
      acronym: "ACH",
      icon: ClipboardList,
      links: [
        { href: "/achats", label: "Bons de commande" },
        { href: "/livraisons", label: "Bons de livraison" },
        { href: "/approvisionnement", label: "Approvisionnement" },
      ],
    },
    {
      title: "Stock & logistique",
      acronym: "STK",
      icon: Boxes,
      links: [
        { href: "/stock", label: "Stock Général" },
        { href: "/depots-annexes", label: "Dépôts annexes" },
        { href: "/transferts", label: "Transferts de stock" },
      ],
    },
    {
      title: "Livraisons",
      acronym: "LIV",
      icon: Send,
      links: [{ href: "/livraison-clients", label: "Livraison client" }],
    },
    {
      title: "Dépenses",
      acronym: "DEP",
      icon: Wallet,
      links: [{ href: "/depenses", label: "Dépenses" }],
    },
    {
      title: "Finances",
      acronym: "FIN",
      icon: Landmark,
      links: [
        { href: "/caisse", label: "État de ma caisse" },
        ...(canManageCashPoints ? [{ href: "/gestion-caisses-depots", label: "Gestion des caisses et dépôts" }] : []),
        ...(canSeeReports ? [{ href: "/tresorerie", label: "Comptes bancaires" }, { href: "/solde-general", label: "Solde général" }] : []),
      ],
    },
    ...(canSeeHR
      ? [
          {
            title: "Ressources humaines",
            acronym: "RH",
            icon: UserCog,
            links: [
              { href: "/employes", label: "Employés" },
              { href: "/paie", label: "Bulletins de salaire" },
            ],
          },
        ]
      : []),
    {
      title: "Rapports & analytics",
      acronym: "RAP",
      icon: Scale,
      links: [
        { href: "/statistiques", label: "Statistiques" },
        { href: "/bilan", label: "Voir le bilan complet" },
        ...(canSeeReports ? [{ href: "/rapports", label: "Rapports" }] : []),
      ],
    },
    ...(canSeeCancellations
      ? [
          {
            title: "Annulations & contrôle",
            acronym: "ANN",
            icon: Ban,
            links: [{ href: "/annulations", label: "Annulations" }],
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle={`${warehousesCount} dépôt(s)/boutique(s)`} />

      {(lowStockCount > 0 || pendingDeliveries > 0 || unreimbursedAdvances > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {lowStockCount > 0 && (
            <Link
              href="/stock"
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 text-xs font-medium hover:bg-amber-100"
            >
              <AlertTriangle size={13} /> {lowStockCount} produit(s) en stock bas
            </Link>
          )}
          {pendingDeliveries > 0 && (
            <Link
              href="/livraison-clients"
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 text-xs font-medium hover:bg-amber-100"
            >
              <AlertTriangle size={13} /> {pendingDeliveries} livraison(s) en attente
            </Link>
          )}
          {unreimbursedAdvances > 0 && (
            <Link
              href="/caisse"
              className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
            >
              <AlertTriangle size={13} /> {unreimbursedAdvances} avance(s) de caisse à régulariser
            </Link>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <ModuleCard key={m.title} {...m} />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({ title, acronym, icon: Icon, links }: Module) {
  return (
    <div className="bg-gradient-to-b from-blue-50/60 to-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex flex-col items-center text-center mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-2">
          <Icon size={20} />
        </div>
        <p className="text-[11px] font-semibold text-slate-400 tracking-widest">{acronym}</p>
        <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide leading-tight">{title}</h2>
      </div>
      <div className="border-b border-dashed border-slate-200 mb-3" />
      <div className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block w-full text-center rounded-lg bg-blue-50/80 py-2 text-sm text-slate-700 hover:bg-blue-100 hover:text-blue-800 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
