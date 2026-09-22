"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getSession, createSession, hashPassword, generatePassword } from "@/lib/auth";
import { sendAdminCredentialsEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BusinessType } from "@prisma/client";

const BUSINESS_TYPES: readonly BusinessType[] = ["GENERIQUE", "QUINCAILLERIE", "BOISSON", "LIBRAIRIE"];

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function requirePlatformOwner() {
  const user = await getCurrentUser();
  if (!user) return { error: "Non authentifié" } as const;
  if (!user.isPlatformOwner) return { error: "Accès réservé au propriétaire de la plateforme." } as const;
  return { user };
}

export async function createCompany(_prev: unknown, formData: FormData) {
  const check = await requirePlatformOwner();
  if ("error" in check) return { error: check.error };

  const companyName = String(formData.get("companyName") || "").trim();
  const businessTypeRaw = String(formData.get("businessType") || "GENERIQUE");
  const businessType = BUSINESS_TYPES.includes(businessTypeRaw as BusinessType)
    ? (businessTypeRaw as BusinessType)
    : "GENERIQUE";
  const adminName = String(formData.get("adminName") || "").trim();
  const adminEmail = String(formData.get("adminEmail") || "").trim().toLowerCase();

  if (!companyName || !adminName || !adminEmail)
    return { error: "Tous les champs sont requis." };

  const adminPassword = generatePassword();
  const baseSlug = slugify(companyName) || "entreprise";
  let finalSlug = baseSlug;
  let suffix = 1;
  while (await prisma.company.findUnique({ where: { slug: finalSlug } })) {
    suffix += 1;
    finalSlug = `${baseSlug}-${suffix}`;
  }

  try {
    const company = await prisma.company.create({ data: { name: companyName, slug: finalSlug, businessType } });
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        companyId: company.id,
      },
    });
    const emailResult = await sendAdminCredentialsEmail({
      to: adminEmail,
      adminName,
      companyName,
      password: adminPassword,
    });

    revalidatePath("/console");
    // Le mot de passe n'est jamais renvoyé au navigateur, même ici : seul
    // l'email généré le contient, pour qu'il ne transite et ne s'affiche nulle
    // part côté propriétaire de la plateforme.
    return { success: true, companyId: company.id, adminEmail, emailSent: emailResult.ok };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique"))
      return { error: "Cet e-mail est déjà utilisé par un autre compte." };
    return { error: "Erreur lors de la création de l'entreprise." };
  }
}

// Si l'envoi initial échoue (service d'email indisponible...), on ne peut pas
// simplement réafficher le mot de passe généré — il n'a jamais quitté le
// serveur. On en régénère un nouveau et on retente l'envoi, sans jamais
// exposer sa valeur au navigateur.
export async function resendAdminCredentials(companyId: string) {
  const check = await requirePlatformOwner();
  if ("error" in check) return { error: check.error };

  const admin = await prisma.user.findFirst({ where: { companyId, role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!admin || !company) return { error: "Compte administrateur introuvable." };

  const newPassword = generatePassword();
  await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(newPassword) } });

  const emailResult = await sendAdminCredentialsEmail({
    to: admin.email,
    adminName: admin.name,
    companyName: company.name,
    password: newPassword,
  });

  return { success: true, adminEmail: admin.email, emailSent: emailResult.ok };
}

export async function updateCompany(_prev: unknown, formData: FormData) {
  const check = await requirePlatformOwner();
  if ("error" in check) return { error: check.error };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const businessTypeRaw = String(formData.get("businessType") || "GENERIQUE");
  const businessType = BUSINESS_TYPES.includes(businessTypeRaw as BusinessType)
    ? (businessTypeRaw as BusinessType)
    : "GENERIQUE";

  if (!id || !name) return { error: "Le nom de l'entreprise est requis." };

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return { error: "Entreprise introuvable." };

  await prisma.company.update({ where: { id }, data: { name, businessType } });
  revalidatePath("/console");
  return { success: true };
}

export async function toggleCompanyActive(id: string) {
  const check = await requirePlatformOwner();
  if ("error" in check) return { error: check.error };

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return { error: "Entreprise introuvable." };

  await prisma.company.update({ where: { id }, data: { active: !company.active } });
  revalidatePath("/console");
  return { success: true };
}

// Permet au propriétaire de la plateforme d'agir directement dans une
// entreprise (support, vérification) avec les droits d'un administrateur,
// sans jamais créer de compte séparé ni connaître de mot de passe. Le compte
// réel ne change pas (même id, même journal de connexions) : seule la session
// porte désormais l'entreprise "active". Voir getCurrentUser dans src/lib/auth.ts.
export async function enterCompany(companyId: string) {
  const check = await requirePlatformOwner();
  if ("error" in check) return { error: check.error };

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Entreprise introuvable." };

  const session = await getSession();
  if (!session) return { error: "Session expirée." };

  await createSession({ ...session, actingCompanyId: companyId });
  redirect("/dashboard");
}

export async function exitCompany() {
  const session = await getSession();
  if (!session || !session.isPlatformOwner) return { error: "Accès refusé." };

  await createSession({ ...session, actingCompanyId: null });
  redirect("/console");
}
