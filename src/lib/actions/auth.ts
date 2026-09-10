"use server";

import { prisma } from "@/lib/prisma";
import { createSession, destroySession, verifyPassword, getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

export async function login(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Veuillez remplir tous les champs." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "Identifiants incorrects." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Identifiants incorrects." };
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

export async function requireRole(roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  if (!roles.includes(user.role)) throw new Error("Accès refusé pour votre rôle.");
  return user;
}
