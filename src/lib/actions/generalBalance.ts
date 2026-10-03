"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";

// Solde de l'entreprise : solde bancaire total (comptes actifs, Trésorerie)
// + tout l'historique de ventes encaissées (Sale.paidAmount) − toutes les
// dépenses non annulées — pour donner un chiffre d'affaires net global,
// indépendamment de toute période. La base n'est plus saisie à la main :
// elle est toujours synchronisée avec Trésorerie, pour ne jamais diverger.
export async function getGeneralBalanceData() {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const [bankAgg, salesAgg, expensesAgg] = await Promise.all([
    prisma.bankAccount.aggregate({ where: { companyId, active: true }, _sum: { balance: true } }),
    prisma.sale.aggregate({ where: { companyId, status: { not: "ANNULEE" } }, _sum: { paidAmount: true } }),
    prisma.expense.aggregate({ where: { companyId, cancelled: false }, _sum: { amount: true } }),
  ]);

  const baseAmount = bankAgg._sum.balance || 0;
  const totalSalesCollected = salesAgg._sum.paidAmount || 0;
  const totalExpenses = expensesAgg._sum.amount || 0;
  const balance = baseAmount + totalSalesCollected - totalExpenses;

  return {
    success: true as const,
    baseAmount,
    totalSalesCollected,
    totalExpenses,
    balance,
  };
}
