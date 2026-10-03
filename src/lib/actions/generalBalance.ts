"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Solde fictif de l'entreprise (voir GeneralBalance dans schema.prisma) :
// base de départ + tout l'historique de ventes encaissées − toutes les
// dépenses non annulées, sans notion de période — un chiffre d'affaires net
// global, distinct des vrais comptes bancaires de Trésorerie.
export async function getGeneralBalanceData() {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const [record, salesAgg, expensesAgg] = await Promise.all([
    prisma.generalBalance.findUnique({ where: { companyId }, include: { updatedBy: { select: { name: true } } } }),
    prisma.sale.aggregate({ where: { companyId, status: { not: "ANNULEE" } }, _sum: { paidAmount: true } }),
    prisma.expense.aggregate({ where: { companyId, cancelled: false }, _sum: { amount: true } }),
  ]);

  const baseAmount = record?.baseAmount ?? 0;
  const totalSalesCollected = salesAgg._sum.paidAmount || 0;
  const totalExpenses = expensesAgg._sum.amount || 0;
  const balance = baseAmount + totalSalesCollected - totalExpenses;

  return {
    success: true as const,
    baseAmount,
    totalSalesCollected,
    totalExpenses,
    balance,
    updatedAt: record?.updatedAt ?? null,
    updatedByName: record?.updatedBy?.name ?? null,
  };
}

export async function setGeneralBalanceBase(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN")
    return { error: "Seul un administrateur peut modifier la base de départ du solde général." };

  const baseAmount = Number(formData.get("baseAmount") || 0);
  if (!Number.isFinite(baseAmount)) return { error: "Montant invalide." };

  const before = await prisma.generalBalance.findUnique({ where: { companyId } });

  await prisma.generalBalance.upsert({
    where: { companyId },
    create: { companyId, baseAmount, updatedById: user.id },
    update: { baseAmount, updatedById: user.id },
  });

  await logAudit({
    companyId,
    userId: user.id,
    action: "general_balance.base_change",
    entityType: "GeneralBalance",
    entityId: companyId,
    oldValue: { baseAmount: before?.baseAmount ?? 0 },
    newValue: { baseAmount },
  });

  revalidatePath("/tresorerie");
  return { success: true };
}
