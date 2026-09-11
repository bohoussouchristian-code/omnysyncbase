"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
  const adminName = String(formData.get("adminName") || "").trim();
  const adminEmail = String(formData.get("adminEmail") || "").trim().toLowerCase();
  const adminPassword = String(formData.get("adminPassword") || "");

  if (!companyName || !adminName || !adminEmail || adminPassword.length < 8)
    return { error: "Tous les champs sont requis (mot de passe : 8 caractères min)." };

  const baseSlug = slugify(companyName) || "entreprise";
  let finalSlug = baseSlug;
  let suffix = 1;
  while (await prisma.company.findUnique({ where: { slug: finalSlug } })) {
    suffix += 1;
    finalSlug = `${baseSlug}-${suffix}`;
  }

  try {
    const company = await prisma.company.create({ data: { name: companyName, slug: finalSlug } });
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        companyId: company.id,
      },
    });
    revalidatePath("/console");
    return { success: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique"))
      return { error: "Cet e-mail est déjà utilisé par un autre compte." };
    return { error: "Erreur lors de la création de l'entreprise." };
  }
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
