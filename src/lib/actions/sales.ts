"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";
import { LOYALTY_FCFA_PER_POINT_EARNED, LOYALTY_POINT_VALUE_FCFA } from "@/lib/constants";
import type { PaymentMethod } from "@prisma/client";

export type CartItem = { productId?: string; serviceId?: string; quantity: number; unitPrice: number };

export async function createSale(input: {
  warehouseId: string;
  customerId?: string | null;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  amountPaid: number;
  dueDate?: string | null;
  pointsToRedeem?: number;
  notes?: string;
}) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const { warehouseId, customerId, items, paymentMethod, amountPaid, dueDate, notes } = input;

  if (!warehouseId) return { error: "Sélectionnez un dépôt/boutique." };
  if (!items || items.length === 0) return { error: "Le panier est vide." };

  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
  if (!warehouse) return { error: "Dépôt introuvable." };

  const productItems = items.filter((i) => i.productId);
  const serviceItems = items.filter((i) => i.serviceId);

  if (serviceItems.length > 0) {
    const serviceIds = [...new Set(serviceItems.map((i) => i.serviceId!))];
    const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, companyId } });
    if (services.length !== serviceIds.length) return { error: "Une prestation est introuvable." };
  }

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  let pointsUsed = 0;
  let discount = 0;
  if (customerId && input.pointsToRedeem && input.pointsToRedeem > 0) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) return { error: "Client introuvable." };
    pointsUsed = Math.min(
      Math.floor(input.pointsToRedeem),
      Math.floor(customer.loyaltyPoints),
      Math.floor(itemsTotal / LOYALTY_POINT_VALUE_FCFA)
    );
    discount = pointsUsed * LOYALTY_POINT_VALUE_FCFA;
  } else if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) return { error: "Client introuvable." };
  }

  const total = itemsTotal - discount;
  const paid = Math.max(0, amountPaid);

  if (paid < total && !customerId)
    return { error: "Un client est requis pour une vente à crédit ou paiement partiel." };

  const stocks = await prisma.stock.findMany({
    where: { warehouseId, companyId, productId: { in: productItems.map((i) => i.productId!) } },
  });
  const stockMap = new Map(stocks.map((s) => [s.productId, s]));

  // A product can appear in several cart lines (e.g. sold both by piece and by pack),
  // so requested quantities must be summed per product before checking availability.
  const requestedByProduct = new Map<string, number>();
  for (const item of productItems) {
    requestedByProduct.set(item.productId!, (requestedByProduct.get(item.productId!) || 0) + item.quantity);
  }
  for (const [productId, qty] of requestedByProduct) {
    const stock = stockMap.get(productId);
    if (!stock || stock.quantity < qty) {
      const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
      return { error: `Stock insuffisant pour ${product?.name ?? "un produit"}.` };
    }
  }

  const status = paid >= total ? "PAYEE" : paid > 0 ? "PARTIELLE" : "CREDIT";
  const number = generateNumber("V");
  const pointsEarned = customerId ? Math.floor(total / LOYALTY_FCFA_PER_POINT_EARNED) : 0;

  const result = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        number,
        customerId: customerId || null,
        warehouseId,
        userId: user.id,
        totalAmount: total,
        paidAmount: paid,
        paymentMethod,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        pointsEarned,
        pointsUsed,
        notes,
        companyId,
        items: {
          create: items.map((i) => ({
            productId: i.productId || null,
            serviceId: i.serviceId || null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.quantity * i.unitPrice,
            companyId,
          })),
        },
      },
      include: { items: true },
    });

    // Track running quantities in memory so multiple lines for the same product
    // (e.g. one sold by piece, one by pack) decrement correctly in sequence.
    const runningQty = new Map(stocks.map((s) => [s.productId, s.quantity]));
    for (const item of productItems) {
      const stock = stockMap.get(item.productId!)!;
      const newQty = (runningQty.get(item.productId!) ?? stock.quantity) - item.quantity;
      runningQty.set(item.productId!, newQty);
      await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: newQty },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId!,
          warehouseId,
          type: "VENTE",
          quantity: item.quantity,
          reference: number,
          userId: user.id,
          companyId,
        },
      });
    }

    if (paid > 0) {
      await tx.payment.create({
        data: {
          type: "VENTE",
          saleId: sale.id,
          customerId: customerId || null,
          amount: paid,
          method: paymentMethod,
          userId: user.id,
          companyId,
        },
      });
    }

    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(paid < total ? { creditBalance: { increment: total - paid } } : {}),
          loyaltyPoints: { increment: pointsEarned - pointsUsed },
        },
      });
    }

    return sale;
  });

  revalidatePath("/ventes");
  revalidatePath("/stock");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { success: true, saleId: result.id, saleNumber: result.number };
}

export async function cancelSale(saleId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN")
    return { error: "Seul un administrateur peut annuler une vente." };

  const sale = await prisma.sale.findFirst({ where: { id: saleId, companyId }, include: { items: true } });
  if (!sale) return { error: "Vente introuvable." };
  if (sale.status === "ANNULEE") return { error: "Vente déjà annulée." };

  await prisma.$transaction(async (tx) => {
    // Les lignes de prestation n'ont pas de stock à restituer.
    for (const item of sale.items.filter((i) => i.productId)) {
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: item.productId!, warehouseId: sale.warehouseId } },
      });
      if (stock) {
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: stock.quantity + item.quantity } });
      } else {
        await tx.stock.create({
          data: { productId: item.productId!, warehouseId: sale.warehouseId, quantity: item.quantity, companyId },
        });
      }
      await tx.stockMovement.create({
        data: {
          productId: item.productId!,
          warehouseId: sale.warehouseId,
          type: "RETOUR_VENTE",
          quantity: item.quantity,
          reference: sale.number,
          userId: user.id,
          companyId,
        },
      });
    }

    if (sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          ...(sale.totalAmount > sale.paidAmount
            ? { creditBalance: { decrement: sale.totalAmount - sale.paidAmount } }
            : {}),
          // Reverse loyalty effects: take back points earned, refund points that were redeemed.
          loyaltyPoints: { increment: sale.pointsUsed - sale.pointsEarned },
        },
      });
    }

    await tx.sale.update({ where: { id: saleId }, data: { status: "ANNULEE" } });
  });

  revalidatePath("/ventes");
  revalidatePath("/stock");
  revalidatePath("/clients");
  return { success: true };
}
