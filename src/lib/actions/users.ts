"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser, hashPassword, validatePassword, generatePassword } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
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

  if (!name || !email) return { error: "Nom et email requis." };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

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

  await prisma.user.update({ where: { id, companyId }, data: { active: !target.active } });
  revalidatePath("/utilisateurs");
  return { success: true };
}

// Le mot de passe est généré côté serveur et envoyé uniquement par email à
// l'utilisateur concerné — jamais saisi ni affiché à l'administrateur qui
// déclenche la réinitialisation (même principe que la création d'entreprise,
// voir src/lib/actions/console.ts).
export async function resetUserPassword(id: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user: current, companyId } = check;
  if (current.role !== "ADMIN") return { error: "Seul un administrateur peut réinitialiser un mot de passe." };

  const target = await prisma.user.findFirst({ where: { id, companyId } });
  if (!target) return { error: "Utilisateur introuvable." };

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id, companyId }, data: { passwordHash } });

  const emailResult = await sendPasswordResetEmail({
    to: target.email,
    userName: target.name,
    resetByName: current.name,
    password,
  });

  revalidatePath("/utilisateurs");
  return { success: true, emailSent: emailResult.ok };
}

export async function updateUserRole(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user: current, companyId } = check;
  if (current.role !== "ADMIN") return { error: "Seul un administrateur peut modifier les permissions." };

  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "") as Role;
  if (current.id === id) return { error: "Vous ne pouvez pas modifier votre propre rôle." };

  const target = await prisma.user.findFirst({ where: { id, companyId } });
  if (!target) return { error: "Utilisateur introuvable." };

  await prisma.user.update({ where: { id, companyId }, data: { role } });
  revalidatePath("/utilisateurs");
  return { success: true };
}

export async function updateUser(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user: current, companyId } = check;
  if (current.role !== "ADMIN") return { error: "Seul un administrateur peut modifier un utilisateur." };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!name || !email) return { error: "Nom et email requis." };

  const target = await prisma.user.findFirst({ where: { id, companyId } });
  if (!target) return { error: "Utilisateur introuvable." };

  try {
    await prisma.user.update({ where: { id, companyId }, data: { name, email } });
    revalidatePath("/utilisateurs");
    return { success: true };
  } catch {
    return { error: "Cet email est déjà utilisé." };
  }
}
