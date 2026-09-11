import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";
import Link from "next/link";
import { ShoppingCart, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [salesToday, customersDebt, warehousesCount, pendingDeliveries, pendingSales] = await Promise.all([
    prisma.sale.aggregate({
      where: { companyId, date: { gte: startOfDay }, status: { notIn: ["ANNULEE", "EN_ATTENTE"] } },
      _sum: { paidAmount: true, totalAmount: true },
      _count: true,
    }),
    prisma.customer.aggregate({ where: { companyId }, _sum: { creditBalance: true } }),
    prisma.warehouse.count({ where: { active: true, companyId } }),
    prisma.purchase.findMany({
      where: { companyId, status: "EN_ATTENTE" },
      orderBy: { date: "asc" },
      take: 8,
      include: { supplier: true },
    }),
    prisma.sale.findMany({
      where: { companyId, status: "EN_ATTENTE" },
      orderBy: { date: "asc" },
      take: 8,
      include: { customer: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Aperçu de votre entreprise — ${warehousesCount} dépôt(s)/boutique(s)`}
      />

      <DashboardModule title="Gestion des achats et ventes" icon={ShoppingCart} last>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Ventes aujourd'hui"
            value={formatMoney(salesToday._sum.totalAmount || 0)}
            hint={`${salesToday._count} vente(s)`}
          />
          <StatCard
            label="Dettes clients"
            value={formatMoney(customersDebt._sum.creditBalance || 0)}
            tone="warning"
          />
        </div>

        {pendingSales.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Ventes en attente de caisse</h3>
              <Link href="/caisse-ventes" className="text-sm text-blue-600 hover:underline">
                Aller à la caisse
              </Link>
            </div>
            <ul className="space-y-2">
              {pendingSales.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {s.customer?.name || "Client comptant"}{" "}
                    <span className="text-slate-400">— {s.number} (saisie le {formatDate(s.date)})</span>
                  </span>
                  <Badge tone="warning">{formatMoney(s.totalAmount)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {pendingDeliveries.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Livraisons en attente</h3>
              <Link href="/livraisons" className="text-sm text-blue-600 hover:underline">
                Voir les livraisons
              </Link>
            </div>
            <ul className="space-y-2">
              {pendingDeliveries.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {p.supplier.name} <span className="text-slate-400">— {p.number} (commandée le {formatDate(p.date)})</span>
                  </span>
                  <Badge tone="warning">{formatMoney(p.totalAmount)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </DashboardModule>
    </div>
  );
}

function DashboardModule({
  title,
  icon: Icon,
  children,
  last = false,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "" : "mb-8"}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-blue-600" />
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
