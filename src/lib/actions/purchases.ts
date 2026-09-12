"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";

export type PurchaseCartItem = { productId: string; quantity: number; unitPrice: number };

export async function createPurchase(input: {
  supplierId: string;
  items: PurchaseCartItem[];
  amountPaid: number;
  notes?: string;
}) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const { supplierId, items, amountPaid, notes } = input;
  if (!supplierId) return { error: "Fournisseur requis." };
  if (!items || items.length === 0) return { error: "Ajoutez au moins un article." };

  const [supplier, generalWarehouse] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, companyId } }),
    prisma.warehouse.findFirst({ where: { companyId, isGeneral: true, active: true } }),
  ]);
  if (!supplier) return { error: "Fournisseur introuvable." };
  if (!generalWarehouse)
    return { error: "Aucun Dépôt Général actif. Créez ou désignez-en un depuis Dépôts / Boutiques." };

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const paid = Math.max(0, Math.min(amountPaid, total));
  const number = generateNumber("A");

  // Une commande est d'abord un brouillon librement modifiable : ni le stock
  // ni la dette fournisseur ne sont touchés tant qu'elle n'est pas validée
  // (voir validatePurchase). Le stock n'entre qu'à la réception (receivePurchase).
  const purchase = await prisma.purchase.create({
    data: {
      number,
      supplierId,
      warehouseId: generalWarehouse.id,
      userId: user.id,
      totalAmount: total,
      paidAmount: paid,
      status: "EN_ATTENTE",
      notes,
      companyId,
      items: {
        create: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          companyId,
        })),
      },
    },
  });

  revalidatePath("/achats");
  return { success: true, purchaseId: purchase.id, purchaseNumber: purchase.number };
}

export async function updatePurchase(
  purchaseId: string,
  input: { supplierId: string; items: PurchaseCartItem[]; amountPaid: number; notes?: string }
) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const { supplierId, items, amountPaid, notes } = input;
  if (!supplierId) return { error: "Fournisseur requis." };
  if (!items || items.length === 0) return { error: "Ajoutez au moins un article." };

  const existing = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId } });
  if (!existing) return { error: "Commande introuvable." };
  if (existing.validatedAt) return { error: "Cette commande est validée : elle ne peut plus être modifiée." };

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) return { error: "Fournisseur introuvable." };

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const paid = Math.max(0, Math.min(amountPaid, total));

  await prisma.$transaction(async (tx) => {
    await tx.purchaseItem.deleteMany({ where: { purchaseId } });
    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        supplierId,
        totalAmount: total,
        paidAmount: paid,
        notes,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            companyId,
          })),
        },
      },
    });
  });

  revalidatePath("/achats");
  return { success: true };
}

// Fige définitivement le contenu de la commande (fournisseur, articles,
// montants) et enregistre à cet instant seulement le paiement et la dette
// fournisseur — jamais avant, tant que la commande n'est qu'un brouillon.
export async function validatePurchase(purchaseId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const purchase = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId } });
  if (!purchase) return { error: "Commande introuvable." };
  if (purchase.validatedAt) return { error: "Commande déjà validée." };
  if (purchase.status === "ANNULEE") return { error: "Commande annulée." };

  await prisma.$transaction(async (tx) => {
    if (purchase.paidAmount > 0) {
      await tx.payment.create({
        data: {
          type: "ACHAT",
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          amount: purchase.paidAmount,
          userId: user.id,
          companyId,
        },
      });
    }
    const due = purchase.totalAmount - purchase.paidAmount;
    if (due > 0) {
      await tx.supplier.update({ where: { id: purchase.supplierId }, data: { balance: { increment: due } } });
    }
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { validatedAt: new Date(), validatedById: user.id },
    });
  });

  revalidatePath("/achats");
  revalidatePath("/fournisseurs");
  return { success: true };
}

export async function receivePurchase(purchaseId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, companyId },
    include: { items: true },
  });
  if (!purchase) return { error: "Commande introuvable." };
  if (!purchase.validatedAt) return { error: "Validez d'abord la commande avant de la réceptionner." };
  if (purchase.status === "RECUE") return { error: "Déjà réceptionnée." };
  if (purchase.status === "ANNULEE") return { error: "Commande annulée." };

  await prisma.$transaction(async (tx) => {
    for (const item of purchase.items) {
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: purchase.warehouseId } },
      });
      if (stock) {
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: stock.quantity + item.quantity } });
      } else {
        await tx.stock.create({
          data: { productId: item.productId, warehouseId: purchase.warehouseId, quantity: item.quantity, companyId },
        });
      }
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          warehouseId: purchase.warehouseId,
          type: "ACHAT",
          quantity: item.quantity,
          reference: purchase.number,
          userId: user.id,
          companyId,
        },
      });
    }
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { status: "RECUE", receivedAt: new Date(), receivedById: user.id },
    });
  });

  revalidatePath("/achats");
  revalidatePath("/stock");
  return { success: true };
}

export async function addSupplierPayment(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const supplierId = String(formData.get("supplierId") || "");
  const amount = Number(formData.get("amount") || 0);
  const purchaseId = String(formData.get("purchaseId") || "") || null;

  if (!supplierId || amount <= 0) return { error: "Montant invalide." };

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) return { error: "Fournisseur introuvable." };
  if (purchaseId) {
    const purchase = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId } });
    if (!purchase) return { error: "Commande introuvable." };
    if (!purchase.validatedAt) return { error: "Validez d'abord cette commande avant d'y rattacher un paiement." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { type: "DETTE_FOURNISSEUR", supplierId, purchaseId, amount, userId: user.id, companyId },
    });
    await tx.supplier.update({ where: { id: supplierId }, data: { balance: { decrement: amount } } });
    if (purchaseId) {
      await tx.purchase.update({ where: { id: purchaseId }, data: { paidAmount: { increment: amount } } });
    }
  });

  revalidatePath("/fournisseurs");
  revalidatePath("/achats");
  return { success: true };
}
