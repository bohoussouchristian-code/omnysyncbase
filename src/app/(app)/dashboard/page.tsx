import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { Card, PageHeader } from "@/components/ui";
import Link from "next/link";
import { ShoppingCart, Wallet, ClipboardList, Boxes, Scale, type LucideIcon } from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    salesToday,
    pendingSalesCount,
    expensesMonth,
    openSessionsCount,
    pendingDeliveriesCount,
    suppliersDebt,
    products,
    salesMonth,
    warehousesCount,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { companyId, date: { gte: startOfDay }, status: { notIn: ["ANNULEE", "EN_ATTENTE"] } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.sale.count({ where: { companyId, status: "EN_ATTENTE" } }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.cashSession.count({ where: { companyId, closedAt: null } }),
    prisma.purchase.count({ where: { companyId, status: "EN_ATTENTE" } }),
    prisma.supplier.aggregate({ where: { companyId }, _sum: { balance: true } }),
    prisma.product.findMany({
      where: { active: true, companyId },
      include: { stocks: true },
    }),
    prisma.sale.findMany({
      where: { companyId, date: { gte: startOfMonth }, status: { notIn: ["ANNULEE", "EN_ATTENTE"] } },
      include: { items: { include: { product: true } } },
    }),
    prisma.warehouse.count({ where: { active: true, companyId } }),
  ]);

  const lowStockCount = products.filter((p) => {
    const totalQty = p.stocks.reduce((s, st) => s + st.quantity, 0);
    return p.reorderLevel > 0 && totalQty <= p.reorderLevel;
  }).length;

  const revenueMonth = salesMonth.reduce((s, sale) => s + sale.totalAmount, 0);
  const cogsMonth = salesMonth.reduce(
    (s, sale) => s + sale.items.reduce((si, it) => si + it.quantity * (it.product?.purchasePrice ?? 0), 0),
    0
  );
  const profitMonth = revenueMonth - cogsMonth - (expensesMonth._sum.amount || 0);

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Aperçu de votre entreprise — ${warehousesCount} dépôt(s)/boutique(s)`}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ModuleCard
          title="Gestion des ventes"
          icon={ShoppingCart}
          href="/ventes"
          stats={[
            { label: "Ventes aujourd'hui", value: formatMoney(salesToday._sum.totalAmount || 0) },
            { label: "En attente de caisse", value: String(pendingSalesCount), tone: pendingSalesCount > 0 ? "warning" : "default" },
          ]}
        />
        <ModuleCard
          title="Gestion financière"
          icon={Wallet}
          href="/caisse"
          stats={[
            { label: "Dépenses (mois)", value: formatMoney(expensesMonth._sum.amount || 0) },
            { label: "Caisses ouvertes", value: String(openSessionsCount) },
          ]}
        />
        <ModuleCard
          title="Gestion appro & fournisseurs"
          icon={ClipboardList}
          href="/achats"
          stats={[
            { label: "Livraisons en attente", value: String(pendingDeliveriesCount), tone: pendingDeliveriesCount > 0 ? "warning" : "default" },
            { label: "Dettes fournisseurs", value: formatMoney(suppliersDebt._sum.balance || 0), tone: "warning" },
          ]}
        />
        <ModuleCard
          title="Gestion du stock"
          icon={Boxes}
          href="/stock"
          stats={[
            { label: "Alertes stock bas", value: String(lowStockCount), tone: lowStockCount > 0 ? "danger" : "default" },
          ]}
        />
        <ModuleCard
          title="Bilan & état financier"
          icon={Scale}
          href="/bilan"
          stats={[
            { label: "Chiffre d'affaires (mois)", value: formatMoney(revenueMonth) },
            {
              label: "Bénéfice estimé (mois)",
              value: formatMoney(profitMonth),
              tone: profitMonth >= 0 ? "success" : "danger",
            },
          ]}
        />
      </div>
    </div>
  );
}

function ModuleCard({
  title,
  icon: Icon,
  href,
  stats,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  stats: { label: string; value: string; tone?: "default" | "warning" | "danger" | "success" }[];
}) {
  const toneClass = {
    default: "text-slate-900",
    warning: "text-amber-600",
    danger: "text-red-600",
    success: "text-emerald-600",
  };

  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-lg font-semibold ${toneClass[s.tone ?? "default"]}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <Link href={href} className="text-sm text-blue-600 hover:underline self-start">
        Voir plus →
      </Link>
    </Card>
  );
}
