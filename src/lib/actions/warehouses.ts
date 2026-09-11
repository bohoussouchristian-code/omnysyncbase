"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createWarehouse(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN")
    return { error: "Seul un administrateur peut créer un dépôt." };

  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim() || null;
  const type = String(formData.get("type") || "BOUTIQUE") as "ENTREPOT" | "BOUTIQUE";

  if (!name) return { error: "Le nom est requis." };

  // Chaque entreprise doit toujours avoir un Dépôt Général : le tout premier
  // dépôt créé endosse automatiquement ce rôle (modifiable ensuite).
  const hasGeneral = await prisma.warehouse.findFirst({ where: { companyId, isGeneral: true } });

  await prisma.warehouse.create({ data: { name, address, type, companyId, isGeneral: !hasGeneral } });
  revalidatePath("/entrepots");
  return { success: true };
}

export async function setGeneralWarehouse(id: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN")
    return { error: "Seul un administrateur peut désigner le Dépôt Général." };

  const warehouse = await prisma.warehouse.findFirst({ where: { id, companyId } });
  if (!warehouse) return { error: "Dépôt introuvable." };
  if (!warehouse.active) return { error: "Ce dépôt est inactif." };
  if (warehouse.isGeneral) return { success: true };

  await prisma.$transaction([
    prisma.warehouse.updateMany({ where: { companyId, isGeneral: true }, data: { isGeneral: false } }),
    prisma.warehouse.update({ where: { id }, data: { isGeneral: true } }),
  ]);
  revalidatePath("/entrepots");
  return { success: true };
}

// Désactiver un dépôt est temporairement bloqué : nécessite une validation du
// développeur avant d'être réactivé, pour éviter tout usage détourné.
export async function toggleWarehouseActive(_id: string) {
  return { error: "Cette action est désactivée en attendant une validation. Contactez le développeur pour l'activer." };
}
