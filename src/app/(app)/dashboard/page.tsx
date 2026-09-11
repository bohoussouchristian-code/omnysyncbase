import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    salesToday,
    salesMonth,
    expensesMonth,
    customersDebt,
    suppliersDebt,
    products,
    recentSales,
    warehousesCount,
    overdueSales,
    pendingDeliveries,
    recentTransfers,
    warehouseNamesList,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { companyId, date: { gte: startOfDay }, status: { not: "ANNULEE" } },
      _sum: { paidAmount: true, totalAmount: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where: { companyId, date: { gte: startOfMonth }, status: { not: "ANNULEE" } },
      include: { items: { include: { product: true } } },
    }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.customer.aggregate({ where: { companyId }, _sum: { creditBalance: true } }),
    prisma.supplier.aggregate({ where: { companyId }, _sum: { balance: true } }),
    prisma.product.findMany({
      where: { active: true, companyId },
      include: { stocks: true },
    }),
    prisma.sale.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 6,
      include: { customer: true, warehouse: true },
    }),
    prisma.warehouse.count({ where: { active: true, companyId } }),
    prisma.sale.findMany({
      where: { companyId, status: { in: ["CREDIT", "PARTIELLE"] }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { customer: true },
    }),
    prisma.purchase.findMany({
      where: { companyId, status: "EN_ATTENTE" },
      orderBy: { date: "asc" },
      take: 8,
      include: { supplier: true },
    }),
    prisma.stockMovement.findMany({
      where: { companyId, type: "TRANSFERT_SORTIE" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { product: true, warehouse: true, user: true },
    }),
    prisma.warehouse.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);

  const warehouseNames = new Map(warehouseNamesList.map((w) => [w.id, w.name]));

  const revenueMonth = salesMonth.reduce((s, sale) => s + sale.totalAmount, 0);
  const cogsMonth = salesMonth.reduce(
    (s, sale) => s + sale.items.reduce((si, it) => si + it.quantity * (it.product?.purchasePrice ?? 0), 0),
    0
  );
  const profitMonth = revenueMonth - cogsMonth - (expensesMonth._sum.amount || 0);

  const lowStock = products.filter((p) => {
    const totalQty = p.stocks.reduce((s, st) => s + st.quantity, 0);
    return p.reorderLevel > 0 && totalQty <= p.reorderLevel;
  });

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Aperçu de votre entreprise — ${warehousesCount} dépôt(s)/boutique(s)`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Ventes aujourd'hui"
          value={formatMoney(salesToday._sum.totalAmount || 0)}
          hint={`${salesToday._count} vente(s)`}
        />
        <StatCard
          label="Bénéfice estimé (mois)"
          value={formatMoney(profitMonth)}
          tone={profitMonth >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Dettes clients"
          value={formatMoney(customersDebt._sum.creditBalance || 0)}
          tone="warning"
        />
        <StatCard
          label="Dettes fournisseurs"
          value={formatMoney(suppliersDebt._sum.balance || 0)}
          tone="warning"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Ventes récentes</h2>
            <Link href="/ventes/historique" className="text-sm text-blue-600 hover:underline">
              Voir tout
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune vente enregistrée pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-2 font-medium">N°</th>
                    <th className="pb-2 font-medium">Client</th>
                    <th className="pb-2 font-medium">Boutique</th>
                    <th className="pb-2 font-medium">Statut</th>
                    <th className="pb-2 font-medium text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 font-medium text-slate-700">{s.number}</td>
                      <td className="py-2 text-slate-600">{s.customer?.name || "Client comptant"}</td>
                      <td className="py-2 text-slate-600">{s.warehouse.name}</td>
                      <td className="py-2">
                        <Badge
                          tone={
                            s.status === "PAYEE"
                              ? "success"
                              : s.status === "ANNULEE"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-medium">{formatMoney(s.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Alertes stock bas</h2>
            <Link href="/stock" className="text-sm text-blue-600 hover:underline">
              Voir tout
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune alerte pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 8).map((p) => {
                const qty = p.stocks.reduce((s, st) => s + st.quantity, 0);
                return (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{p.name}</span>
                    <Badge tone="danger">{qty} restant(s)</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {overdueSales.length > 0 && (
        <Card className="p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Dettes clients en retard</h2>
            <Link href="/clients" className="text-sm text-blue-600 hover:underline">
              Voir les clients
            </Link>
          </div>
          <ul className="space-y-2">
            {overdueSales.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {s.customer?.name || "Client comptant"}{" "}
                  <span className="text-slate-400">— {s.number} (échéance {formatDate(s.dueDate!)})</span>
                </span>
                <Badge tone="danger">{formatMoney(s.totalAmount - s.paidAmount)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pendingDeliveries.length > 0 && (
        <Card className="p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Livraisons en attente</h2>
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

      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Derniers transferts de stock</h2>
          <Link href="/transferts" className="text-sm text-blue-600 hover:underline">
            Voir tout
          </Link>
        </div>
        {recentTransfers.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun transfert enregistré pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {recentTransfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {t.product.name}{" "}
                  <span className="text-slate-400">
                    — {t.warehouse.name} → {(t.relatedWarehouseId && warehouseNames.get(t.relatedWarehouseId)) || "—"}
                  </span>
                </span>
                <Badge tone="info">{t.quantity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
