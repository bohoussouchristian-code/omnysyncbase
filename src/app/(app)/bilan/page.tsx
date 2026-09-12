import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import Link from "next/link";

export default async function BilanPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [salesMonth, expensesMonth, suppliersDebt, overdueSales] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, date: { gte: startOfMonth }, status: { notIn: ["ANNULEE", "EN_ATTENTE"] } },
      include: { items: { include: { product: true } } },
    }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.supplier.aggregate({ where: { companyId }, _sum: { balance: true } }),
    prisma.sale.findMany({
      where: { companyId, status: { in: ["CREDIT", "PARTIELLE"] }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { customer: true },
    }),
  ]);

  const revenueMonth = salesMonth.reduce((s, sale) => s + sale.totalAmount, 0);
  const cogsMonth = salesMonth.reduce(
    (s, sale) => s + sale.items.reduce((si, it) => si + it.quantity * (it.product?.purchasePrice ?? 0), 0),
    0
  );
  const profitMonth = revenueMonth - cogsMonth - (expensesMonth._sum.amount || 0);

  return (
    <div>
      <PageHeader
        title="Bilan & état financier"
        subtitle="Résultat du mois et situation des dettes"
        action={<PrintButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Chiffre d'affaires (mois)" value={formatMoney(revenueMonth)} />
        <StatCard label="Dépenses (mois)" value={formatMoney(expensesMonth._sum.amount || 0)} />
        <StatCard
          label="Bénéfice estimé (mois)"
          value={formatMoney(profitMonth)}
          tone={profitMonth >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Marge (mois)"
          value={revenueMonth > 0 ? `${Math.round((profitMonth / revenueMonth) * 100)}%` : "—"}
          tone={profitMonth >= 0 ? "success" : "danger"}
        />
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Dettes et retards</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatCard
            label="Dettes fournisseurs"
            value={formatMoney(suppliersDebt._sum.balance || 0)}
            tone="warning"
          />
          <StatCard
            label="Dettes clients en retard"
            value={formatMoney(overdueSales.reduce((s, sale) => s + (sale.totalAmount - sale.paidAmount), 0))}
            tone="danger"
          />
        </div>
        {overdueSales.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Clients en retard</p>
              <Link href="/clients" className="no-print text-sm text-blue-600 hover:underline">
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
          </div>
        )}
      </Card>
    </div>
  );
}
