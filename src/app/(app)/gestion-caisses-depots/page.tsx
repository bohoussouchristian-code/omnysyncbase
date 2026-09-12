import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CaissesDepotsClient } from "@/components/cash/CaissesDepotsClient";
import {
  getSessionsWithChangeGiven,
  getOpenPointsSummary,
  getCashCollected,
  getChangeGivenTotal,
  getCancelledSalesStats,
} from "@/lib/cashSessionStats";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function GestionCaissesDepotsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  // Vue d'ensemble réservée à l'administration : contrairement à "État de mes
  // caisses" (personnel), ceci montre les clôtures de TOUS les agents.
  if (user.role !== "ADMIN" && user.role !== "GERANT") redirect("/dashboard");
  const companyId = user.companyId;

  const { from: fromParam, to: toParam } = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10);
  const fromStr = fromParam || toISODate(defaultFrom);
  const toStr = toParam || toISODate(now);
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const [sessions, openPoints, totalCollected, changeGivenTotal, cancelledSales] = await Promise.all([
    getSessionsWithChangeGiven(companyId, from, to),
    getOpenPointsSummary(companyId),
    getCashCollected(companyId, from, to),
    getChangeGivenTotal(companyId, from, to),
    getCancelledSalesStats(companyId, from, to),
  ]);

  return (
    <CaissesDepotsClient
      sessions={sessions}
      from={fromStr}
      to={toStr}
      stats={{
        totalCollected,
        openPointsCount: openPoints.count,
        openPointsTotal: openPoints.total,
        changeGivenTotal,
        cancelledSalesCount: cancelledSales.count,
        cancelledSalesTotal: cancelledSales.total,
      }}
    />
  );
}
