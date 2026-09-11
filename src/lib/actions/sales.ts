"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";
import { LOYALTY_FCFA_PER_POINT_EARNED, LOYALTY_POINT_VALUE_FCFA } from "@/lib/constants";
import type { PaymentMethod } from "@prisma/client";

export type CartItem = { productId?: string; serviceId?: string; quantity: number; unitPrice: number };

// La vente est saisie ici (panier, client, articles) sans toucher au stock ni
// au paiement : c'est la caisse (validateSale) qui, séparément, encaisse et
// décrémente le stock. La caisse ne sert qu'à valider un paiement, pas à saisir.
export async function createSale(input: {
  warehouseId: string;
  customerId?: string | null;
  items: CartItem[];
  pointsToRedeem?: number;
  notes?: string;
}) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const { warehouseId, customerId, items, notes } = input;

  if (!warehouseId) return { error: "Sélectionnez un dépôt/boutique." };
  if (!items || items.length === 0) return { error: "Le panier est vide." };

  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
  if (!warehouse) return { error: "Dépôt introuvable." };

  const serviceItems = items.filter((i) => i.serviceId);
  if (serviceItems.length > 0) {
    const serviceIds = [...new Set(serviceItems.map((i) => i.serviceId!))];
    const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, companyId } });
    if (services.length !== serviceIds.length) return { error: "Une prestation est introuvable." };
  }

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  let pointsUsed = 0;
  let discount = 0;
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) return { error: "Client introuvable." };
    if (input.pointsToRedeem && input.pointsToRedeem > 0) {
      pointsUsed = Math.min(
        Math.floor(input.pointsToRedeem),
        Math.floor(customer.loyaltyPoints),
        Math.floor(itemsTotal / LOYALTY_POINT_VALUE_FCFA)
      );
      discount = pointsUsed * LOYALTY_POINT_VALUE_FCFA;
    }
  }

  const total = itemsTotal - discount;
  const number = generateNumber("V");
  const pointsEarned = customerId ? Math.floor(total / LOYALTY_FCFA_PER_POINT_EARNED) : 0;

  const sale = await prisma.sale.create({
    data: {
      number,
      customerId: customerId || null,
      warehouseId,
      userId: user.id,
      totalAmount: total,
      paidAmount: 0,
      status: "EN_ATTENTE",
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
  });

  revalidatePath("/ventes");
  revalidatePath("/caisse-ventes");
  revalidatePath("/dashboard");
  return { success: true, saleId: sale.id, saleNumber: sale.number };
}

// Étape caisse : encaisse le paiement d'une vente saisie, et c'est seulement
// ici que le stock est décrémenté (comme un bon de livraison pour les achats).
export async function validateSale(input: {
  saleId: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  dueDate?: string | null;
}) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const { saleId, paymentMethod, amountPaid, dueDate } = input;

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId },
    include: { items: true },
  });
  if (!sale) return { error: "Vente introuvable." };
  if (sale.status !== "EN_ATTENTE") return { error: "Cette vente a déjà été traitée." };

  // Un agent ne peut encaisser que s'il a ouvert sa caisse pour ce dépôt :
  // c'est cette session qui absorbe le paiement et qu'il devra justifier à la fermeture.
  const openSession = await prisma.cashSession.findFirst({
    where: { companyId, warehouseId: sale.warehouseId, userId: user.id, closedAt: null },
  });
  if (!openSession) return { error: "Ouvrez d'abord votre caisse pour ce dépôt avant d'encaisser." };

  const paid = Math.max(0, amountPaid);
  const total = sale.totalAmount;
  if (paid < total && !sale.customerId)
    return { error: "Un client est requis pour une vente à crédit ou paiement partiel." };

  const productItems = sale.items.filter((i) => i.productId);
  const stocks = await prisma.stock.findMany({
    where: { warehouseId: sale.warehouseId, companyId, productId: { in: productItems.map((i) => i.productId!) } },
  });
  const stockMap = new Map(stocks.map((s) => [s.productId, s]));

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

  await prisma.$transaction(async (tx) => {
    const runningQty = new Map(stocks.map((s) => [s.productId, s.quantity]));
    for (const item of productItems) {
      const stock = stockMap.get(item.productId!)!;
      const newQty = (runningQty.get(item.productId!) ?? stock.quantity) - item.quantity;
      runningQty.set(item.productId!, newQty);
      await tx.stock.update({ where: { id: stock.id }, data: { quantity: newQty } });
      await tx.stockMovement.create({
        data: {
          productId: item.productId!,
          warehouseId: sale.warehouseId,
          type: "VENTE",
          quantity: item.quantity,
          reference: sale.number,
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
          customerId: sale.customerId,
          amount: paid,
          method: paymentMethod,
          userId: user.id,
          companyId,
        },
      });
    }

    if (sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          ...(paid < total ? { creditBalance: { increment: total - paid } } : {}),
          loyaltyPoints: { increment: sale.pointsEarned - sale.pointsUsed },
        },
      });
    }

    await tx.sale.update({
      where: { id: saleId },
      data: {
        status,
        paidAmount: paid,
        paymentMethod,
        dueDate: paid < total && dueDate ? new Date(dueDate) : null,
        validatedAt: new Date(),
        validatedById: user.id,
      },
    });
  });

  revalidatePath("/ventes");
  revalidatePath("/caisse-ventes");
  revalidatePath("/stock");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { success: true };
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

  // Une vente encore en attente à la caisse n'a jamais touché ni le stock ni
  // le client : il suffit de l'annuler, rien à réverser.
  if (sale.status === "EN_ATTENTE") {
    await prisma.sale.update({ where: { id: saleId }, data: { status: "ANNULEE" } });
    revalidatePath("/ventes");
    revalidatePath("/caisse-ventes");
    return { success: true };
  }

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
  revalidatePath("/caisse-ventes");
  revalidatePath("/stock");
  revalidatePath("/clients");
  return { success: true };
}
