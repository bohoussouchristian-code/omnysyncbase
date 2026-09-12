import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CashClient } from "@/components/cash/CashClient";

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

  const [warehouses, sessionsRaw, mySession, openSessions, cashCollected, changeGivenTotal] =
    await Promise.all([
      prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
      prisma.cashSession.findMany({
        where: { companyId, openedAt: { gte: from, lte: to } },
        orderBy: { openedAt: "desc" },
        take: 60,
        include: { warehouse: true, user: true },
      }),
      prisma.cashSession.findFirst({
        where: { userId: user.id, closedAt: null, companyId },
        include: { warehouse: true },
      }),
      // Sessions actuellement ouvertes, tous utilisateurs confondus (indépendant
      // de la période affichée : "Point caisse ouverte" reflète l'instant présent).
      prisma.cashSession.findMany({ where: { companyId, closedAt: null } }),
      // Montant total encaissé en espèces/mixte sur la période, toutes caisses confondues.
      prisma.sale.aggregate({
        where: {
          companyId,
          status: { not: "ANNULEE" },
          paymentMethod: { in: ["ESPECES", "MIXTE"] },
          validatedAt: { gte: from, lte: to },
        },
        _sum: { paidAmount: true },
      }),
      // Monnaie rendue aux clients sur la période (paiements espèces).
      prisma.payment.aggregate({
        where: { companyId, method: "ESPECES", date: { gte: from, lte: to } },
        _sum: { changeGiven: true },
      }),
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
        where: { warehouseId: mySession.warehouseId, date: { gte: mySession.openedAt } },
        _sum: { amount: true },
      }),
    ]);
    cumul = mySession.openingAmount + (cashSales._sum.paidAmount || 0) - (expenses._sum.amount || 0);
  }

  // Cumul de chaque caisse actuellement ouverte, pour le total "Point caisse ouverte".
  const openPointsTotal = (
    await Promise.all(
      openSessions.map(async (s) => {
        const [cashSales, expenses] = await Promise.all([
          prisma.sale.aggregate({
            where: {
              warehouseId: s.warehouseId,
              validatedById: s.userId,
              validatedAt: { gte: s.openedAt },
              status: { not: "ANNULEE" },
              paymentMethod: { in: ["ESPECES", "MIXTE"] },
            },
            _sum: { paidAmount: true },
          }),
          prisma.expense.aggregate({
            where: { warehouseId: s.warehouseId, date: { gte: s.openedAt } },
            _sum: { amount: true },
          }),
        ]);
        return s.openingAmount + (cashSales._sum.paidAmount || 0) - (expenses._sum.amount || 0);
      })
    )
  ).reduce((sum, v) => sum + v, 0);

  // Monnaie rendue pendant chaque session (paiements espèces de ce caissier,
  // dans ce dépôt, sur la fenêtre d'ouverture de sa caisse).
  const sessions = await Promise.all(
    sessionsRaw.map(async (s) => {
      const changeGiven = await prisma.payment.aggregate({
        where: {
          companyId,
          userId: s.userId,
          method: "ESPECES",
          date: { gte: s.openedAt, lte: s.closedAt ?? new Date() },
          sale: { warehouseId: s.warehouseId },
        },
        _sum: { changeGiven: true },
      });
      return { ...s, changeGivenTotal: changeGiven._sum.changeGiven || 0 };
    })
  );

  return (
    <CashClient
      warehouses={warehouses}
      sessions={sessions}
      mySession={mySession}
      cumul={cumul}
      from={fromStr}
      to={toStr}
      stats={{
        totalCollected: cashCollected._sum.paidAmount || 0,
        openPointsCount: openSessions.length,
        openPointsTotal,
        changeGivenTotal: changeGivenTotal._sum.changeGiven || 0,
      }}
    />
  );
}
