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

// Identifiant lisible et permanent du dossier client (CLI-000001, CLI-000002...),
// attribué une seule fois à la création et jamais réutilisé — c'est la clé qui
// permet de retrouver instantanément tout l'historique du client (ventes,
// paiements, crédit). Compte les clients existants de l'entreprise +1, avec
// une boucle de secours en cas de collision improbable (comme le slug d'entreprise).
async function generateCustomerCode(companyId: string): Promise<string> {
  let n = await prisma.customer.count({ where: { companyId } });
  for (let attempt = 0; attempt < 10; attempt++) {
    n += 1;
    const code = `CLI-${String(n).padStart(6, "0")}`;
    const exists = await prisma.customer.findFirst({ where: { companyId, code } });
    if (!exists) return code;
  }
  throw new Error("Impossible de générer un identifiant client unique.");
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

  const code = await generateCustomerCode(companyId);
  await prisma.customer.create({ data: { code, name, phone, address, creditLimit, type, companyId } });
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

  await prisma.customer.update({ where: { id, companyId }, data: { name, phone, address, creditLimit, type } });
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
    prisma.customer.update({ where: { id: customerId, companyId }, data: { creditBalance: { decrement: amount } } }),
  ]);

  revalidatePath("/clients");
  return { success: true };
}

async function generateSupplierCode(companyId: string): Promise<string> {
  let n = await prisma.supplier.count({ where: { companyId } });
  for (let attempt = 0; attempt < 10; attempt++) {
    n += 1;
    const code = `FOU-${String(n).padStart(6, "0")}`;
    const exists = await prisma.supplier.findFirst({ where: { companyId, code } });
    if (!exists) return code;
  }
  throw new Error("Impossible de générer un identifiant fournisseur unique.");
}

export async function createSupplier(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;

  if (!name) return { error: "Le nom est requis." };

  const code = await generateSupplierCode(companyId);
  await prisma.supplier.create({ data: { code, name, phone, address, companyId } });
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

  await prisma.supplier.update({ where: { id, companyId }, data: { name, phone, address } });
  revalidatePath("/fournisseurs");
  return { success: true };
}
