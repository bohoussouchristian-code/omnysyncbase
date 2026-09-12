"use server";

import { prisma } from "@/lib/prisma";
import { createSession, destroySession, verifyPassword, hashPassword, validatePassword, getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
// Hash factice pour un compte inexistant : on lui fait subir le même coût
// bcrypt qu'une vérification réelle, sinon la réponse plus rapide sur un
// email inconnu permettrait de deviner quels comptes existent (timing attack).
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q6r/i6HW9Aq6pTn/oXjxHKWKwRlxK";

export async function login(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Veuillez remplir tous les champs." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    await verifyPassword(password, DUMMY_HASH);
    return { error: "Identifiants incorrects." };
  }

  // Compte verrouillé après trop d'échecs : on refuse sans même vérifier le
  // mot de passe, pour ne pas laisser continuer les tentatives pendant le blocage.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Compte temporairement bloqué après plusieurs échecs. Réessayez dans ${minutesLeft} min.` };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lockingNow = attempts >= MAX_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lockingNow ? 0 : attempts,
        lockedUntil: lockingNow ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null,
      },
    });
    if (lockingNow) {
      return { error: `Trop de tentatives échouées. Compte bloqué ${LOCKOUT_MINUTES} minutes.` };
    }
    return { error: "Identifiants incorrects." };
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  await createSession({
    userId: user.id,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    isPlatformOwner: user.isPlatformOwner,
  });
  redirect(user.isPlatformOwner ? "/console" : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// Contrairement à resetUserPassword (réservé aux admins, pour un AUTRE
// utilisateur), ceci permet à n'importe quel utilisateur connecté de changer
// son propre mot de passe, à condition de connaître l'actuel.
export async function changeOwnPassword(_prevState: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Non authentifié." };

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");

  if (!currentPassword || !newPassword) {
    return { error: "Veuillez remplir tous les champs." };
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return { error: passwordError };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Mot de passe actuel incorrect." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return { success: true };
}

export async function requireRole(roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  if (!roles.includes(user.role)) throw new Error("Accès refusé pour votre rôle.");
  return user;
}
