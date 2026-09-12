import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import {
  ShoppingCart,
  Wallet,
  ClipboardList,
  Boxes,
  Scale,
  type LucideIcon,
} from "lucide-react";

type ModuleLink = { href: string; label: string };
type Module = { title: string; acronym: string; icon: LucideIcon; links: ModuleLink[] };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const warehousesCount = await prisma.warehouse.count({ where: { active: true, companyId } });

  const canSeeRapports = user.role === "ADMIN" || user.role === "GERANT";

  const modules: Module[] = [
    {
      title: "Gestion des ventes",
      acronym: "GDV",
      icon: ShoppingCart,
      links: [
        { href: "/ventes", label: "Vente du jour" },
        { href: "/ventes/historique", label: "Historique des ventes" },
        { href: "/clients", label: "Clients" },
      ],
    },
    {
      title: "Gestion financière",
      acronym: "GF",
      icon: Wallet,
      links: [
        { href: "/caisse-ventes", label: "Caisse" },
        { href: "/caisse", label: "État de mes caisses" },
        { href: "/depenses", label: "Dépenses" },
        ...(canSeeRapports ? [{ href: "/rapports", label: "Rapports" }] : []),
      ],
    },
    {
      title: "Gestion appro & fournisseurs",
      acronym: "GAF",
      icon: ClipboardList,
      links: [
        { href: "/achats", label: "Bons de commande" },
        { href: "/livraisons", label: "Bons de livraison" },
        { href: "/fournisseurs", label: "Fournisseurs" },
      ],
    },
    {
      title: "Gestion du stock",
      acronym: "GDS",
      icon: Boxes,
      links: [
        { href: "/produits", label: "Configuration des produits" },
        { href: "/stock", label: "Stock Général" },
        { href: "/depots-annexes", label: "Dépôts annexes" },
        { href: "/transferts", label: "Transferts de stock" },
      ],
    },
    {
      title: "Bilan & état financier",
      acronym: "BEF",
      icon: Scale,
      links: [{ href: "/bilan", label: "Voir le bilan complet" }],
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Vos modules — ${warehousesCount} dépôt(s)/boutique(s)`}
      />

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
