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

  await prisma.warehouse.create({ data: { name, address, type, companyId } });
  revalidatePath("/entrepots");
  return { success: true };
}

// Désactiver un dépôt est temporairement bloqué : nécessite une validation du
// développeur avant d'être réactivé, pour éviter tout usage détourné.
export async function toggleWarehouseActive(_id: string) {
  return { error: "Cette action est désactivée en attendant une validation. Contactez le développeur pour l'activer." };
}
