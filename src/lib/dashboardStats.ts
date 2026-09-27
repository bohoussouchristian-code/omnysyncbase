import { prisma } from "@/lib/prisma";
import { getOpenPointsSummary } from "@/lib/cashSessionStats";

export const PRESET_LABELS: Record<string, string> = {
  today: "aujourd'hui",
  yesterday: "hier",
  week: "cette semaine",
  month: "ce mois",
  lastMonth: "le mois précédent",
  year: "cette année",
  custom: "la période choisie",
};

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Bornes de chaque préréglage, toujours calculées côté serveur (jamais fiées
// à l'horloge du navigateur) — un "custom" sans from/to valides retombe sur
// "aujourd'hui" plutôt que d'échouer silencieusement. Partagé entre le
// Tableau de bord et la page Statistiques pour qu'ils calculent toujours les
// mêmes périodes.
export function computeRange(preset: string, fromParam?: string, toParam?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (preset === "custom" && fromParam && toParam) {
    return { from: new Date(`${fromParam}T00:00:00`), to: new Date(`${toParam}T23:59:59.999`) };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (preset === "week") {
    const dayIndex = (now.getDay() + 6) % 7; // lundi = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayIndex);
    return { from: startOfDay(monday), to: endOfDay(now) };
  }
  if (preset === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  }
  if (preset === "lastMonth") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: first, to: last };
  }
  if (preset === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
  }
  return { from: startOfDay(now), to: endOfDay(now) };
}

// Les mêmes indicateurs "Sur la période" / "État actuel" affichés en haut du
// Tableau de bord — extraits ici pour être réutilisés tels quels par la page
// Statistiques (module dédié), sans dupliquer le calcul.
export async function getPeriodStats(companyId: string, from: Date, to: Date) {
  const [salesPeriod, expensesPeriod, purchasesPeriod, products, overdueSales, suppliersDebt, bankAccounts, openPoints, pendingDeliveries, unreimbursedAdvances] =
    await Promise.all([
      prisma.sale.findMany({
        where: { companyId, date: { gte: from, lte: to }, status: { notIn: ["ANNULEE", "EN_ATTENTE"] } },
        include: { items: { include: { product: true } } },
      }),
      prisma.expense.aggregate({
        where: { companyId, date: { gte: from, lte: to }, cancelled: false },
        _sum: { amount: true },
      }),
      prisma.purchase.aggregate({
        where: { companyId, date: { gte: from, lte: to }, status: { not: "ANNULEE" } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.product.findMany({ where: { active: true, companyId }, include: { stocks: true } }),
      prisma.sale.findMany({
        where: { companyId, status: { in: ["CREDIT", "PARTIELLE"] }, dueDate: { lt: new Date() } },
      }),
      prisma.supplier.aggregate({ where: { companyId }, _sum: { balance: true } }),
      prisma.bankAccount.findMany({ where: { companyId, active: true }, select: { balance: true } }),
      getOpenPointsSummary(companyId),
      prisma.delivery.count({ where: { companyId, status: "EN_ATTENTE" } }),
      prisma.cashAdvance.count({ where: { session: { companyId }, reimbursedAt: null } }),
    ]);

  const revenue = salesPeriod.reduce((s, sale) => s + sale.totalAmount, 0);
  const cogs = salesPeriod.reduce(
    (s, sale) => s + sale.items.reduce((si, it) => si + it.quantity * (it.product?.purchasePrice ?? 0), 0),
    0
  );
  const expensesTotal = expensesPeriod._sum.amount || 0;
  const profit = revenue - cogs - expensesTotal;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;

  const stockValue = products.reduce(
    (s, p) => s + p.stocks.reduce((qs, st) => qs + st.quantity, 0) * p.purchasePrice,
    0
  );
  const lowStockCount = products.filter((p) => {
    const qty = p.stocks.reduce((s, st) => s + st.quantity, 0);
    return p.reorderLevel > 0 && qty <= p.reorderLevel;
  }).length;

  const overdueTotal = overdueSales.reduce((s, sale) => s + (sale.totalAmount - sale.paidAmount), 0);
  const bankTotal = bankAccounts.reduce((s, a) => s + a.balance, 0);

  return {
    revenue,
    cogs,
    expensesTotal,
    profit,
    margin,
    salesCount: salesPeriod.length,
    purchasesTotal: purchasesPeriod._sum.totalAmount || 0,
    purchasesCount: purchasesPeriod._count,
    stockValue,
    lowStockCount,
    overdueTotal,
    supplierDebt: suppliersDebt._sum.balance || 0,
    bankTotal,
    openPoints,
    pendingDeliveries,
    unreimbursedAdvances,
    salesPeriod,
  };
}

// Chiffre d'affaires jour par jour sur la période, pour un mini-graphique
// (voir SalesTrendChart) — un point par jour, y compris les jours à 0 FCFA,
// pour que la tendance reste lisible.
export function buildDailyTrend(sales: { date: Date; totalAmount: number }[], from: Date, to: Date) {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const dailyRevenue = new Map<string, number>();
  for (const sale of sales) {
    dailyRevenue.set(dayKey(sale.date), (dailyRevenue.get(dayKey(sale.date)) || 0) + sale.totalAmount);
  }
  const startDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const trendData: { label: string; fullLabel: string; amount: number }[] = [];
  for (const d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    trendData.push({
      label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
      fullLabel: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
      amount: dailyRevenue.get(dayKey(d)) || 0,
    });
  }
  return trendData;
}
