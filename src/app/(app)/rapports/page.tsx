import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatMoney, toCSV } from "@/lib/utils";
import { Card, StatCard, PageHeader } from "@/components/ui";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { SalesTrendChart } from "@/components/reports/SalesTrendChart";
import Link from "next/link";

const PERIODS = {
  "7j": 7,
  "30j": 30,
  "90j": 90,
} as const;

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current?.companyId || (current.role !== "ADMIN" && current.role !== "GERANT")) redirect("/dashboard");
  const companyId = current.companyId;

  const { periode } = await searchParams;
  const days = PERIODS[(periode as keyof typeof PERIODS) || "30j"] || 30;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

  const [sales, expenses, products, customersDebt, suppliersDebt] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, date: { gte: from }, status: { not: "ANNULEE" } },
      include: { items: { include: { product: true, service: true } }, user: true },
    }),
    prisma.expense.aggregate({ where: { companyId, date: { gte: from } }, _sum: { amount: true } }),
    prisma.product.findMany({ where: { active: true, companyId }, include: { stocks: true } }),
    prisma.customer.aggregate({ where: { companyId }, _sum: { creditBalance: true } }),
    prisma.supplier.aggregate({ where: { companyId }, _sum: { balance: true } }),
  ]);

  const revenue = sales.reduce((s, sale) => s + sale.totalAmount, 0);
  // Les prestations n'ont pas de coût de revient (0) — les charges d'un métier de
  // service (loyer, salaires...) sont suivies séparément via le module Dépenses.
  const cogs = sales.reduce(
    (s, sale) => s + sale.items.reduce((si, it) => si + it.quantity * (it.product?.purchasePrice ?? 0), 0),
    0
  );
  const expenseTotal = expenses._sum.amount || 0;
  const profit = revenue - cogs - expenseTotal;

  const itemSales = new Map<string, { name: string; qty: number; revenue: number }>();
  const agentSales = new Map<string, { name: string; count: number; revenue: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.productId || item.serviceId || item.id;
      const label = item.product?.name || item.service?.name || "—";
      const entry = itemSales.get(key) || { name: label, qty: 0, revenue: 0 };
      entry.qty += item.quantity;
      entry.revenue += item.subtotal;
      itemSales.set(key, entry);
    }
    const agentKey = sale.userId || "—";
    const agentEntry = agentSales.get(agentKey) || { name: sale.user?.name || "Non attribué", count: 0, revenue: 0 };
    agentEntry.count += 1;
    agentEntry.revenue += sale.totalAmount;
    agentSales.set(agentKey, agentEntry);
  }
  const topProducts = [...itemSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topAgents = [...agentSales.values()].sort((a, b) => b.revenue - a.revenue);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const dailyRevenue = new Map<string, number>();
  for (const sale of sales) {
    dailyRevenue.set(dayKey(sale.date), (dailyRevenue.get(dayKey(sale.date)) || 0) + sale.totalAmount);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trendData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    trendData.push({
      label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
      fullLabel: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
      amount: dailyRevenue.get(dayKey(d)) || 0,
    });
  }

  const stockValue = products.reduce(
    (s, p) => s + p.stocks.reduce((st, s2) => st + s2.quantity, 0) * p.purchasePrice,
    0
  );

  const csv = toCSV(
    ["Produit", "Quantité vendue", "Chiffre d'affaires"],
    topProducts.map((p) => [p.name, p.qty, Math.round(p.revenue)])
  );

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Analyse des performances de votre entreprise"
        action={
          <div className="flex gap-2">
            {Object.keys(PERIODS).map((p) => (
              <Link
                key={p}
                href={`/rapports?periode=${p}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  (periode || "30j") === p
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Chiffre d'affaires" value={formatMoney(revenue)} hint={`${sales.length} vente(s)`} />
        <StatCard label="Coût des marchandises" value={formatMoney(cogs)} />
        <StatCard label="Dépenses" value={formatMoney(expenseTotal)} />
        <StatCard
          label="Bénéfice net"
          value={formatMoney(profit)}
          tone={profit >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <StatCard label="Valeur du stock (au prix d'achat)" value={formatMoney(stockValue)} />
        <StatCard label="Dettes clients" value={formatMoney(customersDebt._sum.creditBalance || 0)} tone="warning" />
      </div>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Évolution du chiffre d&apos;affaires</h2>
        <SalesTrendChart data={trendData} />
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Top 10 ventes (produits &amp; prestations)</h2>
          <ExportCsvButton filename={`top-ventes-${periode || "30j"}.csv`} csv={csv} />
        </div>
        {topProducts.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune vente sur cette période.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-2 font-medium">Produit / Prestation</th>
                <th className="pb-2 font-medium text-right">Quantité vendue</th>
                <th className="pb-2 font-medium text-right">Chiffre d&apos;affaires</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-700">{p.name}</td>
                  <td className="py-2 text-right">{p.qty}</td>
                  <td className="py-2 text-right font-medium">{formatMoney(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Ventes par agent</h2>
        {topAgents.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune vente sur cette période.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium text-right">Ventes</th>
                <th className="pb-2 font-medium text-right">Chiffre d&apos;affaires</th>
              </tr>
            </thead>
            <tbody>
              {topAgents.map((a) => (
                <tr key={a.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-700">{a.name}</td>
                  <td className="py-2 text-right">{a.count}</td>
                  <td className="py-2 text-right font-medium">{formatMoney(a.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Dettes en cours</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Total dû par les clients</span>
            <span className="font-medium text-amber-600">{formatMoney(customersDebt._sum.creditBalance || 0)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Total dû aux fournisseurs</span>
            <span className="font-medium text-amber-600">{formatMoney(suppliersDebt._sum.balance || 0)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
