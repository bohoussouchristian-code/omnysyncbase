import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { DashboardPeriodPicker } from "@/components/DashboardPeriodPicker";
import { formatMoney } from "@/lib/utils";
import { getOpenPointsSummary } from "@/lib/cashSessionStats";
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

const PRESET_LABELS: Record<string, string> = {
  today: "aujourd'hui",
  yesterday: "hier",
  week: "cette semaine",
  month: "ce mois",
  lastMonth: "le mois précédent",
  year: "cette année",
  custom: "la période choisie",
};

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Bornes de chaque préréglage, toujours calculées côté serveur (jamais fiées
// à l'horloge du navigateur) — un "custom" sans from/to valides retombe sur
// "aujourd'hui" plutôt que d'échouer silencieusement.
function computeRange(preset: string, fromParam?: string, toParam?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (preset === "custom" && fromParam && toParam) {
    return { from: new Date(`${fromParam}T00:00:00`), to: new Date(`${toParam}T23:59:59.999`) };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (preset === "week") {
    const dayIndex = (now.getDay() + 6) % 7; // lundi = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayIndex);
    return { from: startOfDay(monday), to: endOfDay(now) };
  }
  if (preset === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  }
  if (preset === "lastMonth") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: first, to: last };
  }
  if (preset === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
  }
  return { from: startOfDay(now), to: endOfDay(now) };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const { preset: presetParam, from: fromParam, to: toParam } = await searchParams;
  const preset = presetParam && PRESET_LABELS[presetParam] ? presetParam : "today";
  const { from, to } = computeRange(preset, fromParam, toParam);

  const permissions = await getEffectivePermissions(user);
  const canManageCashPoints = permissions.has("caisses.gerer");
  const canSeeReports = permissions.has("rapports.voir");
  const canSeeHR = permissions.has("employes.gerer") || permissions.has("paie.gerer");
  const canSeeCancellations =
    permissions.has("ventes.annuler") || permissions.has("depenses.annuler") || permissions.has("livraisons.annuler");

  const [
    salesPeriod,
    expensesPeriod,
    purchasesPeriod,
    warehousesCount,
    products,
    overdueSales,
    suppliersDebt,
    bankAccounts,
    openPoints,
    pendingDeliveries,
    unreimbursedAdvances,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, date: { gte: from, lte: to }, status: { notIn: ["ANNULEE", "EN_ATTENTE"] } },
      include: { items: { include: { product: true } } },
    }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: from, lte: to }, cancelled: false },
      _sum: { amount: true },
    }),
    prisma.purchase.aggregate({
      where: { companyId, date: { gte: from, lte: to }, status: { not: "ANNULEE" } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.warehouse.count({ where: { active: true, companyId } }),
    prisma.product.findMany({ where: { active: true, companyId }, include: { stocks: true } }),
    prisma.sale.findMany({
      where: { companyId, status: { in: ["CREDIT", "PARTIELLE"] }, dueDate: { lt: new Date() } },
    }),
    prisma.supplier.aggregate({ where: { companyId }, _sum: { balance: true } }),
    prisma.bankAccount.findMany({ where: { companyId, active: true }, select: { balance: true } }),
    getOpenPointsSummary(companyId),
    prisma.delivery.count({ where: { companyId, status: "EN_ATTENTE" } }),
    prisma.cashAdvance.count({ where: { session: { companyId }, reimbursedAt: null } }),
  ]);

  const revenue = salesPeriod.reduce((s, sale) => s + sale.totalAmount, 0);
  const cogs = salesPeriod.reduce(
    (s, sale) => s + sale.items.reduce((si, it) => si + it.quantity * (it.product?.purchasePrice ?? 0), 0),
    0
  );
  const expensesTotal = expensesPeriod._sum.amount || 0;
  const profit = revenue - cogs - expensesTotal;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;

  const stockValue = products.reduce(
    (s, p) => s + p.stocks.reduce((qs, st) => qs + st.quantity, 0) * p.purchasePrice,
    0
  );
  const lowStockCount = products.filter((p) => {
    const qty = p.stocks.reduce((s, st) => s + st.quantity, 0);
    return p.reorderLevel > 0 && qty <= p.reorderLevel;
  }).length;

  const overdueTotal = overdueSales.reduce((s, sale) => s + (sale.totalAmount - sale.paidAmount), 0);
  const bankTotal = bankAccounts.reduce((s, a) => s + a.balance, 0);

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
        ...(canSeeReports ? [{ href: "/tresorerie", label: "Comptes bancaires" }] : []),
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
      <PageHeader
        title="Tableau de bord"
        subtitle={`${warehousesCount} dépôt(s)/boutique(s)`}
        action={<DashboardPeriodPicker preset={preset} from={toISODate(from)} to={toISODate(to)} />}
      />

      {(lowStockCount > 0 || pendingDeliveries > 0 || unreimbursedAdvances > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
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

      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-slate-900 mb-3">
          Sur la période <span className="text-slate-400 font-normal">— {PRESET_LABELS[preset]}</span>
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Chiffre d'affaires" value={formatMoney(revenue)} />
          <StatCard label="Ventes" value={String(salesPeriod.length)} />
          <StatCard label="Achats" value={formatMoney(purchasesPeriod._sum.totalAmount || 0)} hint={`${purchasesPeriod._count} bon(s)`} />
          <StatCard label="Dépenses" value={formatMoney(expensesTotal)} />
          <StatCard label="Bénéfice estimé" value={formatMoney(profit)} tone={profit >= 0 ? "success" : "danger"} />
          <StatCard
            label="Marge"
            value={margin != null ? `${margin}%` : "—"}
            tone={profit >= 0 ? "success" : "danger"}
          />
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-slate-900 mb-3">État actuel</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Valeur du stock" value={formatMoney(stockValue)} />
          <StatCard label="Créances clients en retard" value={formatMoney(overdueTotal)} tone="danger" />
          <StatCard label="Dettes fournisseurs" value={formatMoney(suppliersDebt._sum.balance || 0)} tone="warning" />
          <StatCard label="Trésorerie bancaire" value={formatMoney(bankTotal)} />
          <StatCard
            label="Caisses ouvertes"
            value={formatMoney(openPoints.total)}
            hint={`${openPoints.count} session(s)`}
          />
          <StatCard label="Livraisons en attente" value={String(pendingDeliveries)} />
        </div>
      </Card>

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
