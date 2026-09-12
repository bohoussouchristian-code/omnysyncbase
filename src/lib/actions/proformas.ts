"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { generateNumber } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { CustomerType } from "@prisma/client";

function priceForCustomer(p: { salePrice: number; proPrice: number | null; wholesalePrice: number | null }, customerType: CustomerType | null) {
  if (customerType === "REVENDEUR" && p.wholesalePrice) return p.wholesalePrice;
  if (customerType === "PROFESSIONNEL" && p.proPrice) return p.proPrice;
  return p.salePrice;
}

function priceForCustomerService(s: { price: number; proPrice: number | null }, customerType: CustomerType | null) {
  if (customerType === "PROFESSIONNEL" && s.proPrice) return s.proPrice;
  return s.price;
}

type CartItem = { productId?: string; serviceId?: string; quantity: number };

// Un devis n'engage ni le stock ni la caisse : uniquement un document
// informatif pour le client, calculé aux mêmes tarifs qu'une vente (grille
// pro/revendeur selon le client sélectionné).
export async function createProforma(input: {
  customerId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  validUntil: string | null;
  notes: string | null;
  items: CartItem[];
}) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  if (input.items.length === 0) return { error: "Ajoutez au moins un article." };
  if (!input.customerId && !input.clientName?.trim())
    return { error: "Indiquez un client (compte existant ou nom)." };

  const customer = input.customerId
    ? await prisma.customer.findFirst({ where: { id: input.customerId, companyId } })
    : null;
  if (input.customerId && !customer) return { error: "Client introuvable." };

  const productIds = input.items.filter((i) => i.productId).map((i) => i.productId!);
  const serviceIds = input.items.filter((i) => i.serviceId).map((i) => i.serviceId!);
  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, companyId } }),
    prisma.service.findMany({ where: { id: { in: serviceIds }, companyId } }),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const itemsData = input.items.map((item) => {
    if (item.productId) {
      const product = productMap.get(item.productId);
      if (!product) throw new Error("Produit introuvable.");
      const unitPrice = priceForCustomer(product, customer?.type ?? null);
      return { productId: product.id, quantity: item.quantity, unitPrice, subtotal: unitPrice * item.quantity };
    }
    const service = serviceMap.get(item.serviceId!);
    if (!service) throw new Error("Prestation introuvable.");
    const unitPrice = priceForCustomerService(service, customer?.type ?? null);
    return { serviceId: service.id, quantity: item.quantity, unitPrice, subtotal: unitPrice * item.quantity };
  });

  const totalAmount = itemsData.reduce((sum, i) => sum + i.subtotal, 0);
  const number = generateNumber("PF");

  const proforma = await prisma.proforma.create({
    data: {
      number,
      customerId: input.customerId,
      clientName: input.customerId ? null : input.clientName?.trim() || null,
      clientPhone: input.clientPhone?.trim() || null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      notes: input.notes?.trim() || null,
      totalAmount,
      userId: user.id,
      companyId,
      items: { create: itemsData.map((i) => ({ ...i, companyId })) },
    },
  });

  revalidatePath("/proformas");
  return { success: true, proformaId: proforma.id, number };
}

export async function deleteProforma(id: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN") return { error: "Seul un administrateur peut supprimer un devis." };

  const proforma = await prisma.proforma.findFirst({ where: { id, companyId } });
  if (!proforma) return { error: "Devis introuvable." };

  await prisma.proforma.delete({ where: { id, companyId } });
  revalidatePath("/proformas");
  return { success: true };
}
