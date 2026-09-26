"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";

export async function createExpense(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const warehouseId = String(formData.get("warehouseId") || "") || null;
  const category = String(formData.get("category") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const amount = Number(formData.get("amount") || 0);

  if (!category || amount <= 0) return { error: "Catégorie et montant valides requis." };

  if (warehouseId) {
    const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!warehouse) return { error: "Dépôt introuvable." };
  }

  // Si une caisse de dépense existe pour cette catégorie, son solde suit
  // automatiquement toute dépense qui en relève — pas de double saisie.
  const envelope = await prisma.expenseEnvelope.findUnique({
    where: { companyId_category: { companyId, category } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.expense.create({
      data: { warehouseId, category, description, amount, userId: user.id, companyId },
    });
    if (envelope && envelope.active) {
      await tx.expenseEnvelope.update({ where: { id: envelope.id }, data: { balance: { decrement: amount } } });
    }
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  return { success: true };
}

// Réapprovisionne une caisse de dépense (ex: dépôt d'une nouvelle caution
// carburant à la station, ou budget mensuel loyer) — crée l'enveloppe au
// premier réapprovisionnement si elle n'existe pas encore pour cette catégorie.
export async function topUpExpenseEnvelope(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN" && user.role !== "GERANT")
    return { error: "Seul un administrateur ou un gérant peut réapprovisionner une caisse de dépense." };

  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "").trim() || null;

  if (!category) return { error: "Catégorie requise." };
  if (amount <= 0) return { error: "Montant invalide." };

  await prisma.$transaction(async (tx) => {
    const envelope = await tx.expenseEnvelope.upsert({
      where: { companyId_category: { companyId, category } },
      update: { balance: { increment: amount }, totalAllocated: { increment: amount } },
      create: { category, balance: amount, totalAllocated: amount, companyId },
    });
    await tx.expenseEnvelopeTopUp.create({
      data: { envelopeId: envelope.id, amount, note, userId: user.id, companyId },
    });
  });

  revalidatePath("/depenses");
  return { success: true };
}

export async function toggleExpenseEnvelopeActive(envelopeId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN" && user.role !== "GERANT")
    return { error: "Seul un administrateur ou un gérant peut modifier une caisse de dépense." };

  const envelope = await prisma.expenseEnvelope.findFirst({ where: { id: envelopeId, companyId } });
  if (!envelope) return { error: "Caisse de dépense introuvable." };

  await prisma.expenseEnvelope.update({ where: { id: envelope.id }, data: { active: !envelope.active } });
  revalidatePath("/depenses");
  return { success: true };
}

// Émet un bon (ex: bon de carburant) contre une caisse de dépense : décompte
// immédiatement son solde et enregistre la dépense correspondante, pour que
// le journal des dépenses et le suivi budgétaire restent une seule source de
// vérité. La caisse peut passer en négatif (dépassement) — jamais bloquant,
// seulement visible, comme le reste du suivi budgétaire dans l'app.
export async function issueExpenseVoucher(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const envelopeId = String(formData.get("envelopeId") || "");
  const amount = Number(formData.get("amount") || 0);
  const beneficiary = String(formData.get("beneficiary") || "").trim();
  const vehiclePlate = String(formData.get("vehiclePlate") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!envelopeId) return { error: "Caisse de dépense requise." };
  if (amount <= 0) return { error: "Montant invalide." };
  if (!beneficiary) return { error: "Bénéficiaire requis." };

  const envelope = await prisma.expenseEnvelope.findFirst({ where: { id: envelopeId, companyId } });
  if (!envelope) return { error: "Caisse de dépense introuvable." };
  if (!envelope.active) return { error: "Cette caisse de dépense est désactivée." };

  const number = generateNumber("BON");

  const voucher = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        category: envelope.category,
        description: `Bon ${number} — ${beneficiary}${vehiclePlate ? ` (${vehiclePlate})` : ""}`,
        amount,
        userId: user.id,
        companyId,
      },
    });
    await tx.expenseEnvelope.update({ where: { id: envelope.id }, data: { balance: { decrement: amount } } });
    return tx.expenseVoucher.create({
      data: {
        number,
        envelopeId: envelope.id,
        amount,
        beneficiary,
        vehiclePlate,
        notes,
        expenseId: expense.id,
        issuedById: user.id,
        companyId,
      },
    });
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  return { success: true, voucherId: voucher.id, voucherNumber: voucher.number };
}
