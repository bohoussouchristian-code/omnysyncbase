"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Notification interne à l'app (cloche dans l'en-tête) : lue au fil de la
// navigation ou via un sondage périodique côté client (voir NotificationBell),
// jamais une vraie notification push navigateur. Générée pour l'instant
// uniquement par l'assignation d'une livraison (voir createDelivery dans
// src/lib/actions/deliveries.ts).
export async function getMyNotifications() {
  const check = await requireCompanyUser();
  if ("error" in check) return { notifications: [], unreadCount: 0 };
  const { user, companyId } = check;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount };
}

export async function markNotificationRead(id: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  await prisma.notification.updateMany({ where: { id, userId: user.id, companyId }, data: { read: true } });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  await prisma.notification.updateMany({ where: { userId: user.id, companyId, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
  return { success: true };
}
