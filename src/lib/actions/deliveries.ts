"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { requireOpenSessionForPayment } from "@/lib/actions/cash";
import { userHasPermission } from "@/lib/actions/permissions";
import { revalidatePath } from "next/cache";
import { generateNumber } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import type { PaymentMethod, Role } from "@prisma/client";

function canManageDeliveries(user: { id: string; role: Role }) {
  return userHasPermission(user, "livraisons.gerer");
}

// Ce qui est décidé au cas par cas (zone, distance, secteur...) est le prix
// par bouteille (`pricePerBottle`), jamais le montant final : celui-ci se
// déduit toujours en multipliant par le nombre total de bouteilles (quantité
// de casiers × bouteilles par casier du produit livré), recalculé ici
// côté serveur — jamais une saisie libre qui pourrait diverger du calcul.
export async function createDelivery(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (!(await canManageDeliveries(user)))
    return { error: "Permission manquante : enregistrer une livraison." };

  const saleId = String(formData.get("saleId") || "") || null;
  const customerId = String(formData.get("customerId") || "") || null;
  const productId = String(formData.get("productId") || "") || null;
  const assignedToId = String(formData.get("assignedToId") || "") || null;
  const destination = String(formData.get("destination") || "").trim();
  const quantity = Number(formData.get("quantity") || 0);
  const pricePerBottle = Number(formData.get("pricePerBottle") || 0);
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!destination) return { error: "Destination requise." };
  if (!productId) return { error: "Produit requis pour calculer le montant de la livraison." };
  if (quantity <= 0) return { error: "La quantité (en casiers) doit être supérieure à 0." };
  if (pricePerBottle <= 0) return { error: "Le prix par bouteille doit être supérieur à 0." };
  if (!customerId) return { error: "Client requis." };
  if (!assignedToId) return { error: "Agent assigné requis." };

  const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
  if (!product) return { error: "Produit introuvable." };

  if (saleId) {
    const sale = await prisma.sale.findFirst({ where: { id: saleId, companyId } });
    if (!sale) return { error: "Vente introuvable." };
  }
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) return { error: "Client introuvable." };
  const assignee = await prisma.user.findFirst({ where: { id: assignedToId, companyId, active: true } });
  if (!assignee) return { error: "Employé introuvable." };

  const totalBottles = quantity * product.piecesPerPack;
  const fee = pricePerBottle * totalBottles;

  const number = generateNumber("LIV");
  await prisma.$transaction(async (tx) => {
    await tx.delivery.create({
      data: {
        number,
        saleId,
        customerId,
        productId,
        assignedToId,
        destination,
        quantity,
        pricePerBottle,
        fee,
        notes,
        userId: user.id,
        companyId,
      },
    });
    // Assigner une livraison à quelqu'un le prévient aussitôt (cloche de
    // notification) — il n'a pas à consulter le module Livraison client de
    // lui-même pour découvrir qu'on lui a confié une course.
    if (assignedToId) {
      await tx.notification.create({
        data: {
          userId: assignedToId,
          message: `Nouvelle livraison à effectuer : ${destination} (${number})`,
          link: "/livraison-clients",
          companyId,
        },
      });
    }
  });

  revalidatePath("/livraison-clients");
  return { success: true };
}

// Confirmer qu'une livraison a été effectuée revient à celui qui l'a
// réellement faite : un administrateur/gérant peut toujours le faire (comme
// pour tout le reste du module), mais le livreur assigné le peut aussi pour
// sa propre course, même sans droits de gestion par ailleurs.
export async function markDeliveryDelivered(id: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
  if (!delivery) return { error: "Livraison introuvable." };
  if (!(await canManageDeliveries(user)) && delivery.assignedToId !== user.id)
    return { error: "Cette livraison ne vous est pas assignée." };
  if (delivery.status !== "EN_ATTENTE") return { error: "Cette livraison n'est plus en attente." };

  await prisma.delivery.update({ where: { id }, data: { status: "LIVREE", deliveredAt: new Date() } });
  revalidatePath("/livraison-clients");
  return { success: true };
}

// Encaisser les frais d'une livraison est un vrai paiement : comme une vente,
// c'est un acte de caisse, pas de gestion — n'importe quel utilisateur ayant
// une session de caisse ouverte peut le faire (même règle que validateSale),
// pas seulement ceux qui gèrent les livraisons. Une livraison émise apparaît
// donc à la Caisse dès sa création, pour que le paiement y soit validé,
// pendant que le livreur assigné se contente de confirmer la livraison
// elle-même (voir markDeliveryDelivered). Exige une session ouverte pour
// l'agent (comme une vente ou un règlement de dette) et laisse une trace
// (Payment.type LIVRAISON) comptée au montant attendu à la fermeture — voir
// computeExpectedAmount dans src/lib/actions/cash.ts. Une fois payée, la
// livraison ne repasse plus à "impayée" (pas de bouton pour annuler
// silencieusement un encaissement déjà en caisse).
export async function collectDeliveryPayment(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

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
  if (!(await userHasPermission(user, "livraisons.annuler")))
    return { error: "Permission manquante : annuler une livraison." };
  if (!reason.trim()) return { error: "Un motif d'annulation est obligatoire." };

  const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
  if (!delivery) return { error: "Livraison introuvable." };
  if (delivery.status === "ANNULEE") return { error: "Cette livraison est déjà annulée." };

  await prisma.delivery.update({
    where: { id },
    data: {
      status: "ANNULEE",
      notes: [delivery.notes, `Annulée : ${reason}`].filter(Boolean).join(" — "),
      cancelledAt: new Date(),
      cancelledById: user.id,
    },
  });

  await logAudit({
    companyId,
    userId: user.id,
    action: "delivery.cancel",
    entityType: "Delivery",
    entityId: delivery.id,
    oldValue: { status: delivery.status, fee: delivery.fee },
    newValue: { status: "ANNULEE" },
    reason,
  });

  revalidatePath("/livraison-clients");
  revalidatePath("/annulations");
  return { success: true };
}
