"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

  await prisma.expense.create({
    data: { warehouseId, category, description, amount, userId: user.id, companyId },
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  return { success: true };
}
