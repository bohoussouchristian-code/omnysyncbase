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

// Tout flux financier passe par la caisse : ce cumul ne se limite jamais aux
// seules ventes. Il doit refléter aussi tout autre paiement explicitement
// rattaché à cette session (règlement de dette client, frais de livraison...
// voir Payment.sessionId), exactement comme computeExpectedAmount dans
// src/lib/actions/cash.ts au moment de la fermeture — même calcul, deux
// endroits, pour que l'affichage en cours de session ne mente jamais par
// rapport au montant qui sera exigé à la fermeture.
async function computeLiveCumul(session: {
  id: string;
  warehouseId: string;
  userId: string;
  openingAmount: number;
  openedAt: Date;
}) {
  const [cashSales, otherPayments, expenses] = await Promise.all([
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
    prisma.payment.aggregate({
      where: { sessionId: session.id, method: { in: ["ESPECES", "MIXTE"] } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { warehouseId: session.warehouseId, date: { gte: session.openedAt } },
      _sum: { amount: true },
    }),
  ]);
  return (
    session.openingAmount +
    (cashSales._sum.paidAmount || 0) +
    (otherPayments._sum.amount || 0) -
    (expenses._sum.amount || 0)
  );
}

// Sessions actuellement ouvertes (indépendant de la période affichée) et la
// somme de leur cumul en temps réel.
export async function getOpenPointsSummary(companyId: string) {
  const openSessions = await prisma.cashSession.findMany({ where: { companyId, closedAt: null } });
  const total = (await Promise.all(openSessions.map(computeLiveCumul))).reduce((sum, v) => sum + v, 0);
  return { count: openSessions.length, total };
}

export async function getCashCollected(companyId: string, from: Date, to: Date) {
  const [sales, otherPayments] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        companyId,
        status: { not: "ANNULEE" },
        paymentMethod: { in: ["ESPECES", "MIXTE"] },
        validatedAt: { gte: from, lte: to },
      },
      _sum: { paidAmount: true },
    }),
    // Tout paiement rattaché à une caisse (dette client réglée, livraison
    // encaissée...) compte comme de l'argent réellement encaissé — jamais
    // seulement les ventes (voir Payment.sessionId).
    prisma.payment.aggregate({
      where: { companyId, sessionId: { not: null }, method: { in: ["ESPECES", "MIXTE"] }, date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
  ]);
  return (sales._sum.paidAmount || 0) + (otherPayments._sum.amount || 0);
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
