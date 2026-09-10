"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";

export type PurchaseCartItem = { productId: string; quantity: number; unitPrice: number };

export async function createPurchase(input: {
  supplierId: string;
  warehouseId: string;
  items: PurchaseCartItem[];
  amountPaid: number;
  receiveNow: boolean;
  notes?: string;
}) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const { supplierId, warehouseId, items, amountPaid, receiveNow, notes } = input;
  if (!supplierId || !warehouseId) return { error: "Fournisseur et dépôt requis." };
  if (!items || items.length === 0) return { error: "Ajoutez au moins un article." };

  const [supplier, warehouse] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, companyId } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
  ]);
  if (!supplier) return { error: "Fournisseur introuvable." };
  if (!warehouse) return { error: "Dépôt introuvable." };

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const paid = Math.max(0, Math.min(amountPaid, total));
  const number = generateNumber("A");

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        number,
        supplierId,
        warehouseId,
        userId: user.id,
        totalAmount: total,
        paidAmount: paid,
        status: receiveNow ? "RECUE" : "EN_ATTENTE",
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

    if (receiveNow) {
      for (const item of items) {
        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
        });
        if (stock) {
          await tx.stock.update({ where: { id: stock.id }, data: { quantity: stock.quantity + item.quantity } });
        } else {
          await tx.stock.create({
            data: { productId: item.productId, warehouseId, quantity: item.quantity, companyId },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId,
            type: "ACHAT",
            quantity: item.quantity,
            reference: number,
            userId: user.id,
            companyId,
          },
        });
      }
    }

    if (paid > 0) {
      await tx.payment.create({
        data: { type: "ACHAT", purchaseId: purchase.id, supplierId, amount: paid, userId: user.id, companyId },
      });
    }

    if (total - paid > 0) {
      await tx.supplier.update({ where: { id: supplierId }, data: { balance: { increment: total - paid } } });
    }

    return purchase;
  });

  revalidatePath("/achats");
  revalidatePath("/stock");
  revalidatePath("/fournisseurs");
  return { success: true, purchaseId: result.id, purchaseNumber: result.number };
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
    await tx.purchase.update({ where: { id: purchaseId }, data: { status: "RECUE" } });
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
