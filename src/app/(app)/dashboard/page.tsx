import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatMoney, formatDate, formatDateTime } from "@/lib/utils";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";
import Link from "next/link";
import { ShoppingCart, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const [
    salesToday,
    customersDebt,
    warehousesCount,
    pendingDeliveries,
    pendingSales,
    myOpenSessions,
    last7DaysSales,
  ] = await Promise.all([
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
    prisma.cashSession.findMany({
      where: { companyId, userId: user.id, closedAt: null },
      include: { warehouse: true },
    }),
    prisma.sale.findMany({
      where: { companyId, status: { notIn: ["ANNULEE", "EN_ATTENTE"] }, date: { gte: sevenDaysAgo } },
      select: { date: true, paidAmount: true },
    }),
  ]);

  // Cumul en temps réel de chaque caisse ouverte par l'utilisateur : même calcul
  // que closeCashSession (fond initial + ventes espèces depuis l'ouverture - dépenses).
  const myOpenSessionsWithCumul = await Promise.all(
    myOpenSessions.map(async (session) => {
      const [cashSales, expenses] = await Promise.all([
        prisma.sale.aggregate({
          where: {
            warehouseId: session.warehouseId,
            validatedById: session.userId,
            validatedAt: { gte: session.openedAt },
            status: { not: "ANNULEE" },
            paymentMethod: { in: ["ESPECES", "MIXTE"] },
          },
          _sum: { paidAmount: true },
        }),
        prisma.expense.aggregate({
          where: { warehouseId: session.warehouseId, date: { gte: session.openedAt } },
          _sum: { amount: true },
        }),
      ]);
      const cumul = session.openingAmount + (cashSales._sum.paidAmount || 0) - (expenses._sum.amount || 0);
      return { ...session, cumul };
    })
  );

  // Récap quotidien (7 derniers jours) toutes activités confondues, tous dépôts/boutiques.
  // Clé locale "AAAA-MM-JJ" (pas toISOString, qui bascule en UTC et peut décaler le jour).
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dailyTotals = new Map<string, { date: Date; total: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dailyTotals.set(dayKey(d), { date: d, total: 0 });
  }
  for (const s of last7DaysSales) {
    const key = dayKey(s.date);
    const entry = dailyTotals.get(key);
    if (entry) entry.total += s.paidAmount;
  }
  const dailyRecap = [...dailyTotals.values()];

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Aperçu de votre entreprise — ${warehousesCount} dépôt(s)/boutique(s)`}
      />

      <DashboardModule title="Gestion des achats et ventes" icon={ShoppingCart}>
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

      <DashboardModule title="Gestion financière" icon={Wallet} last>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">État de ma caisse</h3>
            <Link href="/caisse-ventes" className="text-sm text-blue-600 hover:underline">
              Aller à la caisse
            </Link>
          </div>
          {myOpenSessionsWithCumul.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune caisse ouverte actuellement.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {myOpenSessionsWithCumul.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {s.warehouse.name}{" "}
                    <span className="text-slate-400">— ouverte depuis {formatDateTime(s.openedAt)}</span>
                  </span>
                  <Badge tone="success">Cumul : {formatMoney(s.cumul)}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Récap quotidien — toutes activités (7 derniers jours)
            </p>
            <ul className="space-y-1.5">
              {dailyRecap.map((d) => (
                <li key={dayKey(d.date)} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{formatDate(d.date)}</span>
                  <span className="font-medium text-slate-800">{formatMoney(d.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
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
