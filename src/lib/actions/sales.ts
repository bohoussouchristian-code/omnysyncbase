"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";
import { LOYALTY_FCFA_PER_POINT_EARNED, LOYALTY_POINT_VALUE_FCFA } from "@/lib/constants";
import { isFneConfigured, submitSaleToFne, type FnePaymentMethod } from "@/lib/fne";
import type { PaymentMethod, CustomerType } from "@prisma/client";

const PAYMENT_METHOD_TO_FNE: Record<PaymentMethod, FnePaymentMethod> = {
  ESPECES: "cash",
  MOBILE_MONEY: "mobile-money",
  VIREMENT: "transfer",
  CREDIT: "deferred",
  // La FNE n'a pas d'équivalent "paiement mixte" — repli documenté sur
  // "espèces", à corriger si la DGI publie un jour un code dédié.
  MIXTE: "cash",
};

export type SaleFneOutcome = {
  fneStatus: "NON_APPLICABLE" | "CERTIFIED" | "FAILED";
  fneReference: string | null;
  fneToken: string | null;
  fneError: string | null;
};

// Tentative de certification FNE après une vente encaissée — best-effort :
// n'importe quel échec (réseau, configuration, réponse DGI) est capturé et
// stocké sur la vente (fneStatus/fneError), jamais remonté comme erreur à
// l'appelant, pour ne jamais bloquer l'encaissement lui-même à cause d'un
// problème côté DGI. Le résultat est renvoyé pour un affichage immédiat.
async function certifySaleToFneBestEffort(saleId: string, companyId: string): Promise<SaleFneOutcome> {
  const notApplicable: SaleFneOutcome = { fneStatus: "NON_APPLICABLE", fneReference: null, fneToken: null, fneError: null };
  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company || !isFneConfigured(company) || !company.fneTaxCode) return notApplicable;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: { include: { product: true, service: true } },
        customer: true,
        warehouse: true,
      },
    });
    if (!sale) return notApplicable;

    // Le prix catalogue OSB est TTC ; la DGI attend un prix unitaire HT par
    // article — on retire le taux de TVA de l'entreprise pour l'obtenir.
    const FNE_TAX_RATES: Record<string, number> = { TVA: 0.18, TVAB: 0.09, TVAC: 0, TVAD: 0 };
    const rate = FNE_TAX_RATES[company.fneTaxCode] ?? 0;

    // Un client anonyme ("client comptant") n'a ni téléphone ni email en
    // base : à défaut, on retombe sur ceux de l'entreprise elle-même plutôt
    // que d'inventer une valeur, ces deux champs étant exigés par la DGI.
    const clientPhone = sale.customer?.phone || company.phone;
    const clientEmail = company.email;
    if (!clientPhone || !clientEmail) {
      const fneError =
        "Téléphone et email de l'entreprise requis (Entreprise > Contact) pour certifier une vente sans client identifié.";
      await prisma.sale.update({ where: { id: saleId }, data: { fneStatus: "FAILED", fneError } });
      return { fneStatus: "FAILED", fneReference: null, fneToken: null, fneError };
    }

    const result = await submitSaleToFne(company, {
      invoiceType: "sale",
      paymentMethod: PAYMENT_METHOD_TO_FNE[sale.paymentMethod],
      template: "B2C",
      isRne: false,
      clientCompanyName: sale.customer?.name || "Client comptant",
      clientPhone,
      clientEmail,
      pointOfSale: sale.warehouse.name,
      establishment: company.name,
      items: sale.items.map((it) => ({
        description: it.product?.name || it.service?.name || "Article",
        quantity: it.quantity,
        amount: it.unitPrice / (1 + rate),
        taxes: [company.fneTaxCode!],
      })),
    });

    const data = result.ok
      ? { fneStatus: "CERTIFIED" as const, fneReference: result.reference, fneToken: result.token, fneError: null }
      : { fneStatus: "FAILED" as const, fneReference: null, fneToken: null, fneError: result.reason };
    await prisma.sale.update({ where: { id: saleId }, data });
    return data;
  } catch (err) {
    const fneError = err instanceof Error ? err.message : "Erreur FNE inconnue.";
    await prisma.sale
      .update({ where: { id: saleId }, data: { fneStatus: "FAILED", fneError } })
      .catch(() => {});
    return { fneStatus: "FAILED", fneReference: null, fneToken: null, fneError };
  }
}

export type CartItem = { productId?: string; serviceId?: string; quantity: number; unitPrice: number };

// Le prix envoyé par le client n'est jamais retenu tel quel : il doit
// correspondre au tarif catalogue du produit/prestation pour le type de
// client, à la tolérance d'arrondi près (division prix de lot / quantité).
// Sans ça, un client HTTP forgé pourrait vendre à n'importe quel prix.
const PRICE_TOLERANCE = 1;

function priceForCustomer(
  p: { salePrice: number; proPrice: number | null; wholesalePrice: number | null },
  customerType: CustomerType | null
) {
  if (customerType === "REVENDEUR" && p.wholesalePrice) return p.wholesalePrice;
  if (customerType === "PROFESSIONNEL" && p.proPrice) return p.proPrice;
  return p.salePrice;
}

function priceForCustomerService(s: { price: number; proPrice: number | null }, customerType: CustomerType | null) {
  if (customerType === "PROFESSIONNEL" && s.proPrice) return s.proPrice;
  return s.price;
}

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

  // Un caissier ou magasinier ne peut vendre que depuis le dépôt auquel il
  // est rattaché (voir warehouseId sur User) — même si un client forgé
  // envoyait un autre warehouseId. Admin/Gérant restent libres.
  if (user.role === "CAISSIER" || user.role === "MAGASINIER") {
    if (!user.warehouseId) {
      return { error: "Vous n'êtes rattaché à aucun dépôt. Contactez un administrateur." };
    }
    if (user.warehouseId !== warehouseId) {
      return { error: "Vous ne pouvez vendre que depuis votre dépôt rattaché." };
    }
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
  if (!warehouse) return { error: "Dépôt introuvable." };

  let customer = null;
  if (customerId) {
    customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) return { error: "Client introuvable." };
  }
  const customerType = customer?.type ?? null;

  const productItems = items.filter((i) => i.productId);
  if (productItems.length > 0) {
    const productIds = [...new Set(productItems.map((i) => i.productId!))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, companyId } });
    if (products.length !== productIds.length) return { error: "Un produit est introuvable." };
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of productItems) {
      const product = productMap.get(item.productId!)!;
      const validPrices = [priceForCustomer(product, customerType)];
      if (product.packUnitId) {
        const packPrice = product.packSalePrice ?? product.salePrice * product.piecesPerPack;
        validPrices.push(packPrice / product.piecesPerPack);
      }
      if (!validPrices.some((v) => Math.abs(v - item.unitPrice) <= PRICE_TOLERANCE)) {
        return { error: `Prix invalide pour ${product.name}.` };
      }
    }
  }

  const serviceItems = items.filter((i) => i.serviceId);
  if (serviceItems.length > 0) {
    const serviceIds = [...new Set(serviceItems.map((i) => i.serviceId!))];
    const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, companyId } });
    if (services.length !== serviceIds.length) return { error: "Une prestation est introuvable." };
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    for (const item of serviceItems) {
      const service = serviceMap.get(item.serviceId!)!;
      const validPrice = priceForCustomerService(service, customerType);
      if (Math.abs(validPrice - item.unitPrice) > PRICE_TOLERANCE) {
        return { error: `Prix invalide pour ${service.name}.` };
      }
    }
  }

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  let pointsUsed = 0;
  let discount = 0;
  if (customer && input.pointsToRedeem && input.pointsToRedeem > 0) {
    pointsUsed = Math.min(
      Math.floor(input.pointsToRedeem),
      Math.floor(customer.loyaltyPoints),
      Math.floor(itemsTotal / LOYALTY_POINT_VALUE_FCFA)
    );
    discount = pointsUsed * LOYALTY_POINT_VALUE_FCFA;
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
  amountReceived: number;
  dueDate?: string | null;
}) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const { saleId, paymentMethod, amountReceived, dueDate } = input;

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

  const total = sale.totalAmount;
  // Le client peut donner plus que le dû (appoint en espèces) : le montant reçu
  // ne sert jamais à gonfler la vente au-delà du total, l'excédent est de la
  // monnaie à rendre, tracée séparément sur le paiement (jamais dans paidAmount).
  const received = Math.max(0, amountReceived);
  const paid = Math.min(received, total);
  const changeGiven = paymentMethod === "ESPECES" ? Math.max(0, received - total) : 0;
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
          cashReceived: paymentMethod === "ESPECES" ? received : null,
          changeGiven: paymentMethod === "ESPECES" ? changeGiven : null,
          userId: user.id,
          companyId,
        },
      });
    }

    if (sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId, companyId },
        data: {
          ...(paid < total ? { creditBalance: { increment: total - paid } } : {}),
          loyaltyPoints: { increment: sale.pointsEarned - sale.pointsUsed },
        },
      });
    }

    await tx.sale.update({
      where: { id: saleId, companyId },
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

  const fneOutcome = await certifySaleToFneBestEffort(saleId, companyId);

  revalidatePath("/ventes");
  revalidatePath("/caisse-ventes");
  revalidatePath("/stock");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { success: true, changeGiven, ...fneOutcome };
}

// Toute annulation passe désormais par le module "Annulation de facture" :
// un motif est obligatoire, conservé pour l'audit (qui, quand, pourquoi).
export async function cancelSale(saleId: string, reason: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN")
    return { error: "Seul un administrateur peut annuler une vente." };
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Le motif d'annulation est obligatoire." };

  const sale = await prisma.sale.findFirst({ where: { id: saleId, companyId }, include: { items: true } });
  if (!sale) return { error: "Vente introuvable." };
  if (sale.status === "ANNULEE") return { error: "Vente déjà annulée." };

  // Une vente encore en attente à la caisse n'a jamais touché ni le stock ni
  // le client : il suffit de l'annuler, rien à réverser.
  if (sale.status === "EN_ATTENTE") {
    await prisma.sale.update({
      where: { id: saleId, companyId },
      data: { status: "ANNULEE", cancelReason: trimmedReason, cancelledAt: new Date(), cancelledById: user.id },
    });
    revalidatePath("/ventes");
    revalidatePath("/caisse-ventes");
    revalidatePath("/annulations");
    return { success: true };
  }

  // Une fois la session de caisse dans laquelle la vente a été encaissée
  // clôturée, la caissière a déjà justifié son compte sur ce total : la
  // vente est figée et ne peut plus être annulée.
  if (sale.validatedById && sale.validatedAt) {
    const [coveringSession] = await prisma.cashSession.findMany({
      where: { companyId, warehouseId: sale.warehouseId, userId: sale.validatedById, openedAt: { lte: sale.validatedAt } },
      orderBy: { openedAt: "desc" },
      take: 1,
    });
    if (coveringSession?.closedAt) {
      return { error: "Impossible d'annuler : la caisse a déjà été clôturée pour cette vente." };
    }
  }

  await prisma.$transaction(async (tx) => {
    // Les lignes de prestation n'ont pas de stock à restituer.
    for (const item of sale.items.filter((i) => i.productId)) {
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: item.productId!, warehouseId: sale.warehouseId } },
      });
      if (stock) {
        await tx.stock.update({ where: { id: stock.id, companyId }, data: { quantity: stock.quantity + item.quantity } });
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
        where: { id: sale.customerId, companyId },
        data: {
          ...(sale.totalAmount > sale.paidAmount
            ? { creditBalance: { decrement: sale.totalAmount - sale.paidAmount } }
            : {}),
          // Reverse loyalty effects: take back points earned, refund points that were redeemed.
          loyaltyPoints: { increment: sale.pointsUsed - sale.pointsEarned },
        },
      });
    }

    await tx.sale.update({
      where: { id: saleId, companyId },
      data: { status: "ANNULEE", cancelReason: trimmedReason, cancelledAt: new Date(), cancelledById: user.id },
    });
  });

  revalidatePath("/ventes");
  revalidatePath("/caisse-ventes");
  revalidatePath("/stock");
  revalidatePath("/clients");
  revalidatePath("/annulations");
  return { success: true };
}
