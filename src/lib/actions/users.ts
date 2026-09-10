"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser, hashPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

export async function createUser(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user: current, companyId } = check;
  if (current.role !== "ADMIN") return { error: "Seul un administrateur peut créer des utilisateurs." };

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "CAISSIER") as Role;

  if (!name || !email || password.length < 4)
    return { error: "Nom, email et mot de passe (min 4 caractères) requis." };

  try {
    const passwordHash = await hashPassword(password);
    await prisma.user.create({ data: { name, email, passwordHash, role, companyId } });
    revalidatePath("/utilisateurs");
    return { success: true };
  } catch {
    return { error: "Cet email est déjà utilisé." };
  }
}

export async function toggleUserActive(id: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user: current, companyId } = check;
  if (current.role !== "ADMIN") return { error: "Accès refusé." };
  if (current.id === id) return { error: "Vous ne pouvez pas vous désactiver vous-même." };

  const target = await prisma.user.findFirst({ where: { id, companyId } });
  if (!target) return { error: "Utilisateur introuvable." };

  await prisma.user.update({ where: { id }, data: { active: !target.active } });
  revalidatePath("/utilisateurs");
  return { success: true };
}
