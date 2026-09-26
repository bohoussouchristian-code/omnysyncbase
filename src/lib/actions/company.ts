"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Un logo reste une petite image encodée en base64 (data URI) stockée
// directement en base : évite d'avoir à mettre en place un stockage de
// fichiers dédié pour un simple logo affiché sur les documents.
const MAX_LOGO_LENGTH = 500_000;

export async function updateCompanyInfo(_prev: unknown, formData: FormData) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;
  if (user.role !== "ADMIN")
    return { error: "Seul un administrateur peut modifier les informations de l'entreprise." };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Le nom de l'établissement est obligatoire." };

  const director = String(formData.get("director") || "").trim() || null;
  const headerText = String(formData.get("headerText") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;

  // Le champ caché est toujours soumis avec le logo actuel (nouveau fichier
  // choisi, ou logo existant inchangé) : sa valeur reflète directement l'état
  // voulu, y compris vide si l'utilisateur retire le logo.
  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  if (logoUrl && logoUrl.length > MAX_LOGO_LENGTH) {
    return { error: "Le logo est trop volumineux. Choisissez une image plus légère." };
  }

  const fneNcc = String(formData.get("fneNcc") || "").trim() || null;
  // La clé API n'est jamais renvoyée au navigateur (voir /entreprise) : un
  // champ laissé vide signifie "ne pas changer", jamais "supprimer la clé".
  const fneApiKeyInput = String(formData.get("fneApiKey") || "").trim();
  const fneEnabled = formData.get("fneEnabled") === "on";
  const current = await prisma.company.findUnique({ where: { id: companyId }, select: { fneApiKey: true } });
  const fneApiKey = fneApiKeyInput || current?.fneApiKey || null;
  if (fneEnabled && (!fneNcc || !fneApiKey)) {
    return { error: "Renseignez le NCC et la clé API FNE avant d'activer la FNE." };
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { name, director, headerText, phone, email, address, logoUrl, fneNcc, fneApiKey, fneEnabled },
  });

  revalidatePath("/entreprise");
  revalidatePath("/administration");
  revalidatePath("/dashboard");
  return { success: true };
}
