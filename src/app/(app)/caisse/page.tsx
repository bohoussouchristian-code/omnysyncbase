import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CashClient } from "@/components/cash/CashClient";

export default async function CaissePage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const [warehouses, sessions, mySession, last7DaysSales] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.cashSession.findMany({
      where: { companyId },
      orderBy: { openedAt: "desc" },
      take: 30,
      include: { warehouse: true, user: true },
    }),
    prisma.cashSession.findFirst({
      where: { userId: user.id, closedAt: null, companyId },
      include: { warehouse: true },
    }),
    prisma.sale.findMany({
      where: { companyId, status: { notIn: ["ANNULEE", "EN_ATTENTE"] }, date: { gte: sevenDaysAgo } },
      select: { date: true, paidAmount: true },
    }),
  ]);

  // Cumul en temps réel de la session ouverte : même calcul que closeCashSession
  // (fond initial + ventes espèces depuis l'ouverture - dépenses).
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

  // Récap quotidien (7 derniers jours) toutes activités confondues, tous dépôts/boutiques.
  // Clé locale "AAAA-MM-JJ" (pas toISOString, qui bascule en UTC et peut décaler le jour).
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dailyTotals = new Map<string, { date: Date; total: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dailyTotals.set(dayKey(d), { date: d, total: 0 });
  }
  for (const s of last7DaysSales) {
    const key = dayKey(s.date);
    const entry = dailyTotals.get(key);
    if (entry) entry.total += s.paidAmount;
  }
  const dailyRecap = [...dailyTotals.values()];

  return (
    <CashClient
      warehouses={warehouses}
      sessions={sessions}
      mySession={mySession}
      cumul={cumul}
      dailyRecap={dailyRecap}
    />
  );
}
