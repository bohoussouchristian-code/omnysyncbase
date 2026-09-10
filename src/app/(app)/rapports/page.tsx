import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatMoney, formatDateTime, toCSV } from "@/lib/utils";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";
import { MOVEMENT_TYPE_LABELS } from "@/lib/constants";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { SalesTrendChart } from "@/components/reports/SalesTrendChart";
import Link from "next/link";

const PERIODS = {
  "7j": 7,
  "30j": 30,
  "90j": 90,
} as const;

const MOVEMENT_TYPE_TONE: Record<string, "success" | "danger" | "warning" | "info" | "default"> = {
  ENTREE: "success",
  SORTIE: "danger",
  TRANSFERT_ENTREE: "info",
  TRANSFERT_SORTIE: "info",
  AJUSTEMENT: "warning",
  VENTE: "danger",
  ACHAT: "success",
  RETOUR_VENTE: "success",
  RETOUR_ACHAT: "danger",
};

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

  const [sales, expenses, products, customersDebt, suppliersDebt, stockMovements] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, date: { gte: from }, status: { not: "ANNULEE" } },
      include: { items: { include: { product: true, service: true } }, user: true },
    }),
    prisma.expense.aggregate({ where: { companyId, date: { gte: from } }, _sum: { amount: true } }),
    prisma.product.findMany({
      where: { active: true, companyId },
      include: { stocks: true, unit: true, packUnit: true },
    }),
    prisma.customer.aggregate({ where: { companyId }, _sum: { creditBalance: true } }),
    prisma.supplier.aggregate({ where: { companyId }, _sum: { balance: true } }),
    prisma.stockMovement.findMany({
      where: { companyId, createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        product: { include: { unit: true, packUnit: true } },
        warehouse: true,
        user: true,
      },
    }),
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

  // Un dépôt raisonne en lots (casier, carton...), pas en pièces à l'unité :
  // on affiche donc le stock dans l'unité de lot du produit quand elle existe
  // (ex. "10 casiers" plutôt que "240 pc"), avec le reliquat en pièces le cas échéant.
  const formatStockQty = (
    qty: number,
    p: { unit: { symbol: string } | null; packUnit: { name: string } | null; piecesPerPack: number }
  ) => {
    if (p.packUnit && p.piecesPerPack > 1) {
      const packs = Math.floor(qty / p.piecesPerPack);
      const rest = qty - packs * p.piecesPerPack;
      const restLabel = `${rest} ${p.unit?.symbol || ""}`.trim();
      if (packs === 0) return restLabel;
      const packLabel = `${packs} ${p.packUnit.name}${packs > 1 ? "s" : ""}`;
      return rest > 0 ? `${packLabel} + ${restLabel}` : packLabel;
    }
    return `${qty} ${p.unit?.symbol || ""}`.trim();
  };

  const stockRows = products
    .map((p) => {
      const qty = p.stocks.reduce((s, st) => s + st.quantity, 0);
      return {
        id: p.id,
        name: p.name,
        qty,
        qtyLabel: formatStockQty(qty, p),
        unitCost: p.purchasePrice,
        value: qty * p.purchasePrice,
      };
    })
    .filter((p) => p.qty !== 0)
    .sort((a, b) => b.value - a.value);
  const stockValue = stockRows.reduce((s, p) => s + p.value, 0);

  const csv = toCSV(
    ["Produit", "Quantité vendue", "Chiffre d'affaires"],
    topProducts.map((p) => [p.name, p.qty, Math.round(p.revenue)])
  );

  const stockBalanceCsv = toCSV(
    ["Produit", "Quantité en stock", "Prix d'achat unitaire", "Valeur totale"],
    stockRows.map((p) => [p.name, p.qtyLabel, Math.round(p.unitCost), Math.round(p.value)])
  );

  const stockMovementsCsv = toCSV(
    ["Date", "Produit", "Dépôt", "Type", "Quantité", "Utilisateur"],
    stockMovements.map((m) => [
      formatDateTime(m.createdAt),
      m.product.name,
      m.warehouse.name,
      MOVEMENT_TYPE_LABELS[m.type] || m.type,
      formatStockQty(m.quantity, m.product),
      m.user?.name || "—",
    ])
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

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-slate-900">Bilan de stock actuel</h2>
            <p className="text-xs text-slate-400 mt-0.5">Valorisation au prix d&apos;achat, tous dépôts confondus</p>
          </div>
          <ExportCsvButton filename="bilan-stock.csv" csv={stockBalanceCsv} />
        </div>
        {stockRows.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun stock enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium text-right">Quantité en stock</th>
                  <th className="pb-2 font-medium text-right">Prix d&apos;achat unitaire</th>
                  <th className="pb-2 font-medium text-right">Valeur totale</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-700">{p.name}</td>
                    <td className="py-2 text-right whitespace-nowrap">{p.qtyLabel}</td>
                    <td className="py-2 text-right">{formatMoney(p.unitCost)}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={3} className="pt-2 font-semibold text-slate-900">
                    Total
                  </td>
                  <td className="pt-2 text-right font-semibold text-slate-900">{formatMoney(stockValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-slate-900">Historique des mouvements de stock</h2>
            <p className="text-xs text-slate-400 mt-0.5">Entrées, sorties, transferts, ventes et achats sur la période</p>
          </div>
          <ExportCsvButton filename={`historique-stock-${periode || "30j"}.csv`} csv={stockMovementsCsv} />
        </div>
        {stockMovements.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun mouvement de stock sur cette période.</p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 sticky top-0 bg-white">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium">Dépôt</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium text-right">Quantité</th>
                  <th className="pb-2 font-medium">Utilisateur</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                    <td className="py-2 text-slate-700">{m.product.name}</td>
                    <td className="py-2 text-slate-600">{m.warehouse.name}</td>
                    <td className="py-2">
                      <Badge tone={MOVEMENT_TYPE_TONE[m.type] || "default"}>
                        {MOVEMENT_TYPE_LABELS[m.type] || m.type}
                      </Badge>
                    </td>
                    <td className="py-2 text-right font-medium whitespace-nowrap">
                      {formatStockQty(m.quantity, m.product)}
                    </td>
                    <td className="py-2 text-slate-500">{m.user?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
