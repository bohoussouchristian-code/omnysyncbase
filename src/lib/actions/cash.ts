"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function openCashSession(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const warehouseId = String(formData.get("warehouseId") || "");
  const openingAmount = Number(formData.get("openingAmount") || 0);

  if (!warehouseId) return { error: "Sélectionnez un dépôt/boutique." };

  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
  if (!warehouse) return { error: "Dépôt introuvable." };

  const existing = await prisma.cashSession.findFirst({
    where: { warehouseId, userId: user.id, closedAt: null },
  });
  if (existing) return { error: "Une session de caisse est déjà ouverte pour vous ici." };

  await prisma.cashSession.create({
    data: { warehouseId, userId: user.id, openingAmount, companyId },
  });

  revalidatePath("/caisse");
  return { success: true };
}

export async function closeCashSession(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const id = String(formData.get("id") || "");
  const closingAmount = Number(formData.get("closingAmount") || 0);
  const notes = String(formData.get("notes") || "").trim() || null;

  const session = await prisma.cashSession.findFirst({ where: { id, companyId } });
  if (!session) return { error: "Session introuvable." };
  if (session.closedAt) return { error: "Session déjà fermée." };

  const sales = await prisma.sale.aggregate({
    where: {
      warehouseId: session.warehouseId,
      userId: session.userId,
      date: { gte: session.openedAt },
      status: { not: "ANNULEE" },
      paymentMethod: { in: ["ESPECES", "MIXTE"] },
    },
    _sum: { paidAmount: true },
  });
  const expenses = await prisma.expense.aggregate({
    where: { warehouseId: session.warehouseId, date: { gte: session.openedAt } },
    _sum: { amount: true },
  });

  const expectedAmount =
    session.openingAmount + (sales._sum.paidAmount || 0) - (expenses._sum.amount || 0);

  await prisma.cashSession.update({
    where: { id },
    data: { closingAmount, expectedAmount, closedAt: new Date(), notes },
  });

  revalidatePath("/caisse");
  return { success: true, expectedAmount };
}
