import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { DashboardPeriodPicker } from "@/components/DashboardPeriodPicker";
import { formatMoney } from "@/lib/utils";
import { computeRange, getPeriodStats, buildDailyTrend, toISODate, PRESET_LABELS } from "@/lib/dashboardStats";
import { SalesTrendChart } from "@/components/reports/SalesTrendChart";

// Module dédié aux mêmes indicateurs affichés en haut du Tableau de bord
// ("Sur la période" / "État actuel") — même calcul (voir
// src/lib/dashboardStats.ts), avec en plus la tendance jour par jour du
// chiffre d'affaires. Le Tableau de bord garde sa version condensée pour un
// coup d'œil rapide ; ici, la période s'explore plus en détail.
export default async function StatistiquesPage({
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

  const [stats, warehousesCount] = await Promise.all([
    getPeriodStats(companyId, from, to),
    prisma.warehouse.count({ where: { active: true, companyId } }),
  ]);

  const trendData = buildDailyTrend(stats.salesPeriod, from, to);

  return (
    <div>
      <PageHeader
        title="Statistiques"
        subtitle={`${warehousesCount} dépôt(s)/boutique(s)`}
        action={<DashboardPeriodPicker preset={preset} from={toISODate(from)} to={toISODate(to)} basePath="/statistiques" />}
      />

      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-slate-900 mb-3">
          Sur la période <span className="text-slate-400 font-normal">— {PRESET_LABELS[preset]}</span>
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Chiffre d'affaires" value={formatMoney(stats.revenue)} />
          <StatCard label="Ventes" value={String(stats.salesCount)} />
          <StatCard label="Achats" value={formatMoney(stats.purchasesTotal)} hint={`${stats.purchasesCount} bon(s)`} />
          <StatCard label="Dépenses" value={formatMoney(stats.expensesTotal)} />
          <StatCard
            label="Bénéfice estimé"
            value={formatMoney(stats.profit)}
            tone={stats.profit >= 0 ? "success" : "danger"}
          />
          <StatCard
            label="Marge"
            value={stats.margin != null ? `${stats.margin}%` : "—"}
            tone={stats.profit >= 0 ? "success" : "danger"}
          />
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-slate-900 mb-3">Évolution du chiffre d&apos;affaires</h3>
        <SalesTrendChart data={trendData} />
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-3">État actuel</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Valeur du stock" value={formatMoney(stats.stockValue)} />
          <StatCard label="Créances clients en retard" value={formatMoney(stats.overdueTotal)} tone="danger" />
          <StatCard label="Dettes fournisseurs" value={formatMoney(stats.supplierDebt)} tone="warning" />
          <StatCard label="Trésorerie bancaire" value={formatMoney(stats.bankTotal)} />
          <StatCard
            label="Caisses ouvertes"
            value={formatMoney(stats.openPoints.total)}
            hint={`${stats.openPoints.count} session(s)`}
          />
          <StatCard label="Livraisons en attente" value={String(stats.pendingDeliveries)} />
        </div>
      </Card>
    </div>
  );
}
