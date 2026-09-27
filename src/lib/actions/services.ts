"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/actions/permissions";
import { revalidatePath } from "next/cache";

// Le catalogue de prestations est réservé à l'administrateur par défaut,
// délégable au cas par cas via "prestations.gerer" (voir /utilisateurs).
async function requireManager() {
  return requirePermission("prestations.gerer");
}

export async function createService(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "") || null;
  const durationMinRaw = formData.get("durationMin");
  const durationMin = durationMinRaw && String(durationMinRaw) !== "" ? Number(durationMinRaw) : null;
  const price = Number(formData.get("price") || 0);
  const proPriceRaw = formData.get("proPrice");
  const proPrice = proPriceRaw && String(proPriceRaw) !== "" ? Number(proPriceRaw) : null;

  if (!name) return { error: "Le nom de la prestation est requis." };

  await prisma.service.create({
    data: { name, categoryId, durationMin, price, proPrice, companyId },
  });

  revalidatePath("/prestations");
  return { success: true };
}

export async function updateService(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "") || null;
  const durationMinRaw = formData.get("durationMin");
  const durationMin = durationMinRaw && String(durationMinRaw) !== "" ? Number(durationMinRaw) : null;
  const price = Number(formData.get("price") || 0);
  const proPriceRaw = formData.get("proPrice");
  const proPrice = proPriceRaw && String(proPriceRaw) !== "" ? Number(proPriceRaw) : null;

  if (!id || !name) return { error: "Données invalides." };

  const existing = await prisma.service.findFirst({ where: { id, companyId } });
  if (!existing) return { error: "Prestation introuvable." };

  await prisma.service.update({
    where: { id, companyId },
    data: { name, categoryId, durationMin, price, proPrice },
  });

  revalidatePath("/prestations");
  return { success: true };
}

// Cohérent avec toggleProductActive : bloqué en attendant une validation du
// développeur, pour éviter tout usage détourné.
export async function toggleServiceActive(_id: string) {
  return { error: "Cette action est désactivée en attendant une validation. Contactez le développeur pour l'activer." };
}
