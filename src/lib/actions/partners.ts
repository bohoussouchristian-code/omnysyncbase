"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { CustomerType } from "@prisma/client";

// Créer/modifier une fiche client ou fournisseur est réservé à l'administrateur.
// Encaisser un paiement de dette reste accessible à tous (usage courant).
async function requireManager() {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  if (check.user.role !== "ADMIN")
    return { error: "Seul un administrateur peut modifier cette fiche." } as const;
  return check;
}

export async function createCustomer(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  const creditLimit = Number(formData.get("creditLimit") || 0);
  const type = (String(formData.get("type") || "PARTICULIER") as CustomerType) || "PARTICULIER";

  if (!name) return { error: "Le nom est requis." };

  await prisma.customer.create({ data: { name, phone, address, creditLimit, type, companyId } });
  revalidatePath("/clients");
  return { success: true };
}

export async function updateCustomer(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  const creditLimit = Number(formData.get("creditLimit") || 0);
  const type = (String(formData.get("type") || "PARTICULIER") as CustomerType) || "PARTICULIER";

  if (!id || !name) return { error: "Données invalides." };

  const existing = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!existing) return { error: "Client introuvable." };

  await prisma.customer.update({ where: { id }, data: { name, phone, address, creditLimit, type } });
  revalidatePath("/clients");
  return { success: true };
}

export async function recordCustomerPayment(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const customerId = String(formData.get("customerId") || "");
  const amount = Number(formData.get("amount") || 0);

  if (!customerId || amount <= 0) return { error: "Montant invalide." };

  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) return { error: "Client introuvable." };

  await prisma.$transaction([
    prisma.payment.create({
      data: { type: "DETTE_CLIENT", customerId, amount, userId: user.id, companyId },
    }),
    prisma.customer.update({ where: { id: customerId }, data: { creditBalance: { decrement: amount } } }),
  ]);

  revalidatePath("/clients");
  return { success: true };
}

export async function createSupplier(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;

  if (!name) return { error: "Le nom est requis." };

  await prisma.supplier.create({ data: { name, phone, address, companyId } });
  revalidatePath("/fournisseurs");
  return { success: true };
}

export async function updateSupplier(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;

  if (!id || !name) return { error: "Données invalides." };

  const existing = await prisma.supplier.findFirst({ where: { id, companyId } });
  if (!existing) return { error: "Fournisseur introuvable." };

  await prisma.supplier.update({ where: { id }, data: { name, phone, address } });
  revalidatePath("/fournisseurs");
  return { success: true };
}
