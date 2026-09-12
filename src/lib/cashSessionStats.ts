import { prisma } from "@/lib/prisma";

// Calculs partagés entre "État de mes caisses" (/caisse) et "Gestion des
// caisses et dépôts" (/gestion-caisses-depots) : les deux pages listent les
// mêmes sessions de caisse avec la même logique de monnaie rendue.

export async function getSessionsWithChangeGiven(companyId: string, from: Date, to: Date) {
  const sessionsRaw = await prisma.cashSession.findMany({
    where: { companyId, openedAt: { gte: from, lte: to } },
    orderBy: { openedAt: "desc" },
    take: 200,
    include: { warehouse: true, user: true },
  });

  return Promise.all(
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
}

async function computeLiveCumul(session: { warehouseId: string; userId: string; openingAmount: number; openedAt: Date }) {
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
  return session.openingAmount + (cashSales._sum.paidAmount || 0) - (expenses._sum.amount || 0);
}

// Sessions actuellement ouvertes (indépendant de la période affichée) et la
// somme de leur cumul en temps réel.
export async function getOpenPointsSummary(companyId: string) {
  const openSessions = await prisma.cashSession.findMany({ where: { companyId, closedAt: null } });
  const total = (await Promise.all(openSessions.map(computeLiveCumul))).reduce((sum, v) => sum + v, 0);
  return { count: openSessions.length, total };
}

export async function getCashCollected(companyId: string, from: Date, to: Date) {
  const result = await prisma.sale.aggregate({
    where: {
      companyId,
      status: { not: "ANNULEE" },
      paymentMethod: { in: ["ESPECES", "MIXTE"] },
      validatedAt: { gte: from, lte: to },
    },
    _sum: { paidAmount: true },
  });
  return result._sum.paidAmount || 0;
}

export async function getChangeGivenTotal(companyId: string, from: Date, to: Date) {
  const result = await prisma.payment.aggregate({
    where: { companyId, method: "ESPECES", date: { gte: from, lte: to } },
    _sum: { changeGiven: true },
  });
  return result._sum.changeGiven || 0;
}

// Ventes annulées sur la période : nombre et montant qu'elles représentaient.
export async function getCancelledSalesStats(companyId: string, from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: { companyId, status: "ANNULEE", date: { gte: from, lte: to } },
    select: { totalAmount: true },
  });
  return { count: sales.length, total: sales.reduce((sum, s) => sum + s.totalAmount, 0) };
}
