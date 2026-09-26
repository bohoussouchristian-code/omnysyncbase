"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function requireBankManager(role: string) {
  return role === "ADMIN" || role === "GERANT";
}

export async function createBankAccount(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!requireBankManager(user.role))
    return { error: "Seul un administrateur ou un gérant peut créer un compte bancaire." };

  const name = String(formData.get("name") || "").trim();
  const bankName = String(formData.get("bankName") || "").trim() || null;
  const accountNumber = String(formData.get("accountNumber") || "").trim() || null;
  const openingBalance = Number(formData.get("openingBalance") || 0);

  if (!name) return { error: "Nom du compte requis." };

  await prisma.$transaction(async (tx) => {
    const account = await tx.bankAccount.create({
      data: { name, bankName, accountNumber, balance: openingBalance, companyId },
    });
    if (openingBalance !== 0) {
      await tx.bankTransaction.create({
        data: {
          bankAccountId: account.id,
          type: "RECETTE",
          amount: openingBalance,
          label: "Solde d'ouverture",
          userId: user.id,
          companyId,
        },
      });
    }
  });

  revalidatePath("/tresorerie");
  revalidatePath("/bilan");
  return { success: true };
}

export async function toggleBankAccountActive(accountId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!requireBankManager(user.role))
    return { error: "Seul un administrateur ou un gérant peut modifier un compte bancaire." };

  const account = await prisma.bankAccount.findFirst({ where: { id: accountId, companyId } });
  if (!account) return { error: "Compte introuvable." };

  await prisma.bankAccount.update({ where: { id: account.id }, data: { active: !account.active } });
  revalidatePath("/tresorerie");
  return { success: true };
}

// Une recette (dépôt/encaissement) ou un décaissement (retrait/paiement) sur
// un compte bancaire — le solde du compte suit immédiatement, pour que
// l'application reflète l'état réel du compte bancaire de l'entreprise, comme
// s'il y était directement lié.
export async function recordBankTransaction(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!requireBankManager(user.role))
    return { error: "Seul un administrateur ou un gérant peut enregistrer un mouvement bancaire." };

  const bankAccountId = String(formData.get("bankAccountId") || "");
  const type = String(formData.get("type") || "");
  const amount = Number(formData.get("amount") || 0);
  const label = String(formData.get("label") || "").trim();
  const reference = String(formData.get("reference") || "").trim() || null;

  if (!bankAccountId) return { error: "Compte bancaire requis." };
  if (type !== "RECETTE" && type !== "DECAISSEMENT") return { error: "Type de mouvement invalide." };
  if (amount <= 0) return { error: "Montant invalide." };
  if (!label) return { error: "Libellé requis." };

  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) return { error: "Compte introuvable." };
  if (!account.active) return { error: "Ce compte est désactivé." };

  await prisma.$transaction(async (tx) => {
    await tx.bankTransaction.create({
      data: { bankAccountId, type, amount, label, reference, userId: user.id, companyId },
    });
    await tx.bankAccount.update({
      where: { id: bankAccountId },
      data: { balance: type === "RECETTE" ? { increment: amount } : { decrement: amount } },
    });
  });

  revalidatePath("/tresorerie");
  revalidatePath("/bilan");
  return { success: true };
}
