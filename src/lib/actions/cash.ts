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

// Le montant attendu se base sur les ventes encaissées (validées) pendant la
// session, pas sur leur date de saisie : la caisse ne valide que le paiement,
// qui peut arriver après que la vente ait été saisie par quelqu'un d'autre.
async function computeExpectedAmount(session: {
  warehouseId: string;
  userId: string;
  openingAmount: number;
  openedAt: Date;
}) {
  const sales = await prisma.sale.aggregate({
    where: {
      warehouseId: session.warehouseId,
      validatedById: session.userId,
      validatedAt: { gte: session.openedAt },
      status: { not: "ANNULEE" },
      paymentMethod: { in: ["ESPECES", "MIXTE"] },
    },
    _sum: { paidAmount: true },
  });
  const expenses = await prisma.expense.aggregate({
    where: { warehouseId: session.warehouseId, date: { gte: session.openedAt } },
    _sum: { amount: true },
  });
  return session.openingAmount + (sales._sum.paidAmount || 0) - (expenses._sum.amount || 0);
}

// Étape de vérification avant clôture : recalcule le montant attendu (à jour,
// sans se fier à un cumul potentiellement affiché depuis un moment) pour que
// l'agent compare avec le compte physique avant de confirmer la fermeture.
export async function previewCashClosing(sessionId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const session = await prisma.cashSession.findFirst({ where: { id: sessionId, companyId } });
  if (!session) return { error: "Session introuvable." };
  if (session.closedAt) return { error: "Session déjà fermée." };

  const expectedAmount = await computeExpectedAmount(session);
  return { expectedAmount };
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

  const expectedAmount = await computeExpectedAmount(session);

  await prisma.cashSession.update({
    where: { id },
    data: { closingAmount, expectedAmount, closedAt: new Date(), notes },
  });

  revalidatePath("/caisse");
  revalidatePath("/caisse-ventes");
  return { success: true, expectedAmount };
}
