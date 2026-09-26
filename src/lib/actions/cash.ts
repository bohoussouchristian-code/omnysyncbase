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

async function getUnreimbursedAdvancesTotal(sessionId: string) {
  const result = await prisma.cashAdvance.aggregate({
    where: { sessionId, reimbursedAt: null },
    _sum: { amount: true },
  });
  return result._sum.amount || 0;
}

// Étape de vérification avant clôture : recalcule le montant attendu (à jour,
// sans se fier à un cumul potentiellement affiché depuis un moment) pour que
// l'agent compare avec le compte physique avant de confirmer la fermeture.
export async function previewCashClosing(sessionId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  // Chacun ne peut consulter/fermer que sa propre session : la caisse
  // représente l'argent physique dont cet agent est responsable.
  const session = await prisma.cashSession.findFirst({ where: { id: sessionId, companyId, userId: user.id } });
  if (!session) return { error: "Session introuvable." };
  if (session.closedAt) return { error: "Session déjà fermée." };

  const expectedAmount = await computeExpectedAmount(session);
  const unreimbursedAdvances = await getUnreimbursedAdvancesTotal(sessionId);
  return { expectedAmount, unreimbursedAdvances };
}

// Retrait de caisse pour une dépense urgente et imprévue : ne touche à rien
// d'autre (ni le stock, ni un journal de dépense) — juste une trace de
// l'argent physiquement sorti, à rembourser avant la fermeture de session.
export async function withdrawCashAdvance(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const sessionId = String(formData.get("sessionId") || "");
  const amount = Number(formData.get("amount") || 0);
  const reason = String(formData.get("reason") || "").trim();

  if (amount <= 0) return { error: "Montant invalide." };
  if (!reason) return { error: "Le motif du retrait est obligatoire." };

  const session = await prisma.cashSession.findFirst({ where: { id: sessionId, companyId, userId: user.id } });
  if (!session) return { error: "Session introuvable." };
  if (session.closedAt) return { error: "Cette session est déjà fermée." };

  await prisma.cashAdvance.create({
    data: { sessionId, amount, reason, userId: user.id, companyId },
  });

  revalidatePath("/caisse");
  return { success: true };
}

// Constate que l'argent retiré a été remis en caisse — obligatoire avant que
// la session ne puisse être fermée (voir closeCashSession).
export async function reimburseCashAdvance(advanceId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { companyId, user } = check;

  const advance = await prisma.cashAdvance.findFirst({
    where: { id: advanceId, companyId },
    include: { session: true },
  });
  if (!advance) return { error: "Avance introuvable." };
  if (advance.session.userId !== user.id) return { error: "Cette avance ne vous appartient pas." };
  if (advance.reimbursedAt) return { error: "Cette avance est déjà remboursée." };

  await prisma.cashAdvance.update({ where: { id: advanceId }, data: { reimbursedAt: new Date() } });

  revalidatePath("/caisse");
  return { success: true };
}

export async function closeCashSession(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const id = String(formData.get("id") || "");
  const closingAmount = Number(formData.get("closingAmount") || 0);
  const notes = String(formData.get("notes") || "").trim() || null;

  // Même règle qu'à l'ouverture : on ne ferme que sa propre session.
  const session = await prisma.cashSession.findFirst({ where: { id, companyId, userId: user.id } });
  if (!session) return { error: "Session introuvable." };
  if (session.closedAt) return { error: "Session déjà fermée." };

  // Un retrait de caisse pour dépense urgente doit être remboursé avant toute
  // fermeture — jamais de fermeture avec une avance encore en suspens.
  const unreimbursedAdvances = await getUnreimbursedAdvancesTotal(id);
  if (unreimbursedAdvances > 0) {
    return {
      error: `Remboursez d'abord ${unreimbursedAdvances.toLocaleString("fr-FR")} FCFA d'avance(s) de caisse en cours avant de fermer.`,
    };
  }

  const expectedAmount = await computeExpectedAmount(session);

  // Un manquant bloque totalement la fermeture (il faut remettre l'argent en
  // caisse et recompter) ; un excédent doit au moins être justifié. Revérifié
  // ici pour ne pas dépendre uniquement du contrôle côté client.
  if (closingAmount < expectedAmount) {
    return { error: "Montant compté inférieur au montant attendu : remettez le montant manquant en caisse avant de fermer." };
  }
  if (closingAmount > expectedAmount && !notes) {
    return { error: "Un excédent de caisse doit être justifié avant de confirmer la fermeture." };
  }

  await prisma.cashSession.update({
    where: { id, companyId, userId: user.id },
    data: { closingAmount, expectedAmount, closedAt: new Date(), notes },
  });

  revalidatePath("/caisse");
  revalidatePath("/caisse-ventes");
  return { success: true, expectedAmount };
}
