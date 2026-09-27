"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { requireOpenSessionForPayment } from "@/lib/actions/cash";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";
import type { PaymentMethod } from "@prisma/client";

function requireDeliveryManager(role: string) {
  return role === "ADMIN" || role === "GERANT";
}

// Le montant facturé au client pour une livraison (`fee`) n'est jamais
// calculé automatiquement — c'est un montant décidé au cas par cas (zone,
// distance, quantité...) par un administrateur ou un gérant, jamais une
// formule figée par produit ou par client.
export async function createDelivery(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!requireDeliveryManager(user.role))
    return { error: "Seul un administrateur ou un gérant peut enregistrer une livraison." };

  const saleId = String(formData.get("saleId") || "") || null;
  const customerId = String(formData.get("customerId") || "") || null;
  const destination = String(formData.get("destination") || "").trim();
  const quantityRaw = formData.get("quantity");
  const quantity = quantityRaw && String(quantityRaw) !== "" ? Number(quantityRaw) : null;
  const fee = Number(formData.get("fee") || 0);
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!destination) return { error: "Destination requise." };
  if (fee <= 0) return { error: "Le montant de la livraison doit être supérieur à 0." };

  if (saleId) {
    const sale = await prisma.sale.findFirst({ where: { id: saleId, companyId } });
    if (!sale) return { error: "Vente introuvable." };
  }
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
    if (!customer) return { error: "Client introuvable." };
  }

  const number = generateNumber("LIV");
  await prisma.delivery.create({
    data: { number, saleId, customerId, destination, quantity, fee, notes, userId: user.id, companyId },
  });

  revalidatePath("/livraison-clients");
  return { success: true };
}

export async function markDeliveryDelivered(id: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!requireDeliveryManager(user.role))
    return { error: "Seul un administrateur ou un gérant peut modifier une livraison." };

  const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
  if (!delivery) return { error: "Livraison introuvable." };
  if (delivery.status !== "EN_ATTENTE") return { error: "Cette livraison n'est plus en attente." };

  await prisma.delivery.update({ where: { id }, data: { status: "LIVREE", deliveredAt: new Date() } });
  revalidatePath("/livraison-clients");
  return { success: true };
}

// Encaisser les frais d'une livraison est un vrai paiement : il n'entre pas
// dans la caisse en silence, il exige une session ouverte pour l'agent (comme
// une vente ou un règlement de dette) et laisse une trace (Payment.type
// LIVRAISON) comptée au montant attendu à la fermeture — voir
// computeExpectedAmount dans src/lib/actions/cash.ts. Une fois payée, la
// livraison ne repasse plus à "impayée" (pas de bouton pour annuler
// silencieusement un encaissement déjà en caisse).
export async function collectDeliveryPayment(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!requireDeliveryManager(user.role))
    return { error: "Seul un administrateur ou un gérant peut encaisser une livraison." };

  const deliveryId = String(formData.get("deliveryId") || "");
  const method = (String(formData.get("method") || "ESPECES") as PaymentMethod) || "ESPECES";

  const delivery = await prisma.delivery.findFirst({ where: { id: deliveryId, companyId } });
  if (!delivery) return { error: "Livraison introuvable." };
  if (delivery.paid) return { error: "Cette livraison est déjà payée." };
  if (delivery.status === "ANNULEE") return { error: "Cette livraison est annulée." };

  const sessionCheck = await requireOpenSessionForPayment(user.id, companyId);
  if ("error" in sessionCheck) return { error: sessionCheck.error };
  const { session } = sessionCheck;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        type: "LIVRAISON",
        deliveryId,
        customerId: delivery.customerId,
        amount: delivery.fee,
        method,
        sessionId: session.id,
        userId: user.id,
        companyId,
      },
    }),
    prisma.delivery.update({ where: { id: deliveryId }, data: { paid: true } }),
  ]);

  revalidatePath("/livraison-clients");
  revalidatePath("/caisse");
  return { success: true };
}

export async function cancelDelivery(id: string, reason: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!requireDeliveryManager(user.role))
    return { error: "Seul un administrateur ou un gérant peut annuler une livraison." };
  if (!reason.trim()) return { error: "Un motif d'annulation est obligatoire." };

  const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
  if (!delivery) return { error: "Livraison introuvable." };
  if (delivery.status === "ANNULEE") return { error: "Cette livraison est déjà annulée." };

  await prisma.delivery.update({
    where: { id },
    data: { status: "ANNULEE", notes: [delivery.notes, `Annulée : ${reason}`].filter(Boolean).join(" — ") },
  });
  revalidatePath("/livraison-clients");
  return { success: true };
}
