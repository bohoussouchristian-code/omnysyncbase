import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CashClient } from "@/components/cash/CashClient";
import { getOpenPointsSummary, getCashCollected, getChangeGivenTotal } from "@/lib/cashSessionStats";

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

  const [warehouses, mySession, openPoints, totalCollected, changeGivenTotal] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { id: "desc" } }),
    prisma.cashSession.findFirst({
      where: { userId: user.id, closedAt: null, companyId },
      include: { warehouse: true },
    }),
    getOpenPointsSummary(companyId),
    getCashCollected(companyId, from, to),
    getChangeGivenTotal(companyId, from, to),
  ]);

  const myAdvances = mySession
    ? await prisma.cashAdvance.findMany({ where: { sessionId: mySession.id }, orderBy: { withdrawnAt: "desc" } })
    : [];

  // Cumul en temps réel de la session ouverte de l'utilisateur courant : même
  // calcul que closeCashSession (fond initial + ventes espèces + tout autre
  // paiement rattaché à cette caisse depuis l'ouverture - dépenses) — voir
  // computeExpectedAmount dans src/lib/actions/cash.ts. Aucun flux financier
  // ne doit passer à côté de la caisse : un règlement de dette ou une
  // livraison encaissée compte ici exactement comme une vente.
  let cumul: number | null = null;
  if (mySession) {
    const [cashSales, otherPayments, expenses] = await Promise.all([
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
      prisma.payment.aggregate({
        where: { sessionId: mySession.id, method: { in: ["ESPECES", "MIXTE"] } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { warehouseId: mySession.warehouseId, date: { gte: mySession.openedAt }, cancelled: false },
        _sum: { amount: true },
      }),
    ]);
    cumul =
      mySession.openingAmount +
      (cashSales._sum.paidAmount || 0) +
      (otherPayments._sum.amount || 0) -
      (expenses._sum.amount || 0);
  }

  return (
    <CashClient
      warehouses={warehouses}
      mySession={mySession}
      myAdvances={myAdvances}
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
