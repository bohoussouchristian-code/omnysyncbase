"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getOrCreateStock(companyId: string, productId: string, warehouseId: string) {
  const [product, warehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, companyId } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
  ]);
  if (!product || !warehouse) return null;

  let stock = await prisma.stock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  if (!stock) {
    stock = await prisma.stock.create({ data: { productId, warehouseId, quantity: 0, companyId } });
  }
  return stock;
}

export async function adjustStock(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const productId = String(formData.get("productId") || "");
  const warehouseId = String(formData.get("warehouseId") || "");
  const type = String(formData.get("type") || "ENTREE") as "ENTREE" | "SORTIE" | "AJUSTEMENT";
  const quantity = Number(formData.get("quantity") || 0);
  const reason = String(formData.get("reason") || "").trim() || null;

  if (!productId || !warehouseId || quantity <= 0)
    return { error: "Produit, dépôt et quantité (> 0) requis." };

  const stock = await getOrCreateStock(companyId, productId, warehouseId);
  if (!stock) return { error: "Produit ou dépôt introuvable." };

  let newQty = stock.quantity;
  if (type === "ENTREE") newQty += quantity;
  else if (type === "SORTIE") newQty -= quantity;
  else newQty = quantity;

  if (newQty < 0) return { error: "Stock insuffisant pour cette sortie." };

  await prisma.$transaction([
    prisma.stock.update({ where: { id: stock.id }, data: { quantity: newQty } }),
    prisma.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type,
        quantity: type === "AJUSTEMENT" ? newQty - stock.quantity : quantity,
        reason,
        userId: user.id,
        companyId,
      },
    }),
  ]);

  revalidatePath("/stock");
  return { success: true };
}

export async function transferStock(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const productId = String(formData.get("productId") || "");
  const fromWarehouseId = String(formData.get("fromWarehouseId") || "");
  const toWarehouseId = String(formData.get("toWarehouseId") || "");
  const quantity = Number(formData.get("quantity") || 0);

  if (!productId || !fromWarehouseId || !toWarehouseId)
    return { error: "Produit et dépôts requis." };
  if (fromWarehouseId === toWarehouseId)
    return { error: "Les dépôts source et destination doivent être différents." };
  if (quantity <= 0) return { error: "Quantité invalide." };

  const fromStock = await getOrCreateStock(companyId, productId, fromWarehouseId);
  if (!fromStock) return { error: "Produit ou dépôt source introuvable." };
  if (fromStock.quantity < quantity) return { error: "Stock insuffisant dans le dépôt source." };
  const toStock = await getOrCreateStock(companyId, productId, toWarehouseId);
  if (!toStock) return { error: "Dépôt destination introuvable." };

  await prisma.$transaction([
    prisma.stock.update({
      where: { id: fromStock.id },
      data: { quantity: fromStock.quantity - quantity },
    }),
    prisma.stock.update({
      where: { id: toStock.id },
      data: { quantity: toStock.quantity + quantity },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        warehouseId: fromWarehouseId,
        type: "TRANSFERT_SORTIE",
        quantity,
        relatedWarehouseId: toWarehouseId,
        userId: user.id,
        companyId,
      },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        warehouseId: toWarehouseId,
        type: "TRANSFERT_ENTREE",
        quantity,
        relatedWarehouseId: fromWarehouseId,
        userId: user.id,
        companyId,
      },
    }),
  ]);

  revalidatePath("/stock");
  return { success: true };
}
