import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CashClient } from "@/components/cash/CashClient";
import {
  getSessionsWithChangeGiven,
  getOpenPointsSummary,
  getCashCollected,
  getChangeGivenTotal,
} from "@/lib/cashSessionStats";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function CaissePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const { from: fromParam, to: toParam } = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10);
  const fromStr = fromParam || toISODate(defaultFrom);
  const toStr = toParam || toISODate(now);
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const [warehouses, sessions, mySession, openPoints, totalCollected, changeGivenTotal] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    getSessionsWithChangeGiven(companyId, from, to),
    prisma.cashSession.findFirst({
      where: { userId: user.id, closedAt: null, companyId },
      include: { warehouse: true },
    }),
    getOpenPointsSummary(companyId),
    getCashCollected(companyId, from, to),
    getChangeGivenTotal(companyId, from, to),
  ]);

  // Cumul en temps réel de la session ouverte de l'utilisateur courant : même
  // calcul que closeCashSession (fond initial + ventes espèces depuis
  // l'ouverture - dépenses).
  let cumul: number | null = null;
  if (mySession) {
    const [cashSales, expenses] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          warehouseId: mySession.warehouseId,
          validatedById: mySession.userId,
          validatedAt: { gte: mySession.openedAt },
          status: { not: "ANNULEE" },
          paymentMethod: { in: ["ESPECES", "MIXTE"] },
        },
        _sum: { paidAmount: true },
      }),
      prisma.expense.aggregate({
        where: { warehouseId: mySession.warehouseId, date: { gte: mySession.openedAt }, cancelled: false },
        _sum: { amount: true },
      }),
    ]);
    cumul = mySession.openingAmount + (cashSales._sum.paidAmount || 0) - (expenses._sum.amount || 0);
  }

  return (
    <CashClient
      warehouses={warehouses}
      sessions={sessions}
      mySession={mySession}
      cumul={cumul}
      from={fromStr}
      to={toStr}
      stats={{
        totalCollected,
        openPointsCount: openPoints.count,
        openPointsTotal: openPoints.total,
        changeGivenTotal,
      }}
    />
  );
}
