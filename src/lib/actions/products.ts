"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Le catalogue (produits, catégories, unités) ne peut être ajouté/modifié que par
// un administrateur. Caissiers, magasiniers et gérants utilisent l'application
// (ventes, stock, achats) sans pouvoir modifier les fiches de base.
async function requireManager() {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  if (check.user.role !== "ADMIN")
    return { error: "Seul un administrateur peut modifier le catalogue." } as const;
  return check;
}

// La désactivation d'un produit est temporairement bloquée pour tous les rôles :
// elle nécessite une validation du développeur avant d'être réactivée, pour éviter
// tout usage détourné (masquer un produit pour dissimuler un écart de stock).
const DELETE_LOCKED_MESSAGE =
  "Cette action est désactivée en attendant une validation. Contactez le développeur pour l'activer.";

// Chiffre de contrôle EAN-13 standard (poids 1/3 alternés sur les 12 premiers chiffres).
function ean13CheckDigit(code12: string): number {
  const sum = code12
    .split("")
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

// Le code-barres n'est plus saisi manuellement : on le génère nous-mêmes au
// format EAN-13, avec le préfixe 20-29 réservé à l'usage interne (jamais
// attribué par GS1), pour éviter toute collision avec un vrai code produit.
async function generateUniqueBarcode(companyId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const random = Math.floor(Math.random() * 1e10)
      .toString()
      .padStart(10, "0");
    const code12 = `20${random}`;
    const barcode = `${code12}${ean13CheckDigit(code12)}`;
    const exists = await prisma.product.findFirst({ where: { companyId, barcode } });
    if (!exists) return barcode;
  }
  throw new Error("Impossible de générer un code-barres unique.");
}

// Le prix d'achat variant souvent selon le fournisseur, la fiche produit
// permet d'en enregistrer un par fournisseur (en plus du prix par défaut) —
// transmis comme un tableau JSON depuis le formulaire, validé ici pour ne
// garder que des fournisseurs réels de l'entreprise et des prix positifs.
async function parseSupplierPrices(formData: FormData, companyId: string) {
  const raw = String(formData.get("supplierPrices") || "[]");
  let rows: { supplierId: string; purchasePrice: number }[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const supplierIds = [...new Set(rows.map((r) => r.supplierId).filter(Boolean))];
  const suppliers = await prisma.supplier.findMany({ where: { id: { in: supplierIds }, companyId } });
  const validIds = new Set(suppliers.map((s) => s.id));

  return rows
    .filter((r) => validIds.has(r.supplierId) && Number(r.purchasePrice) >= 0)
    .map((r) => ({ supplierId: r.supplierId, purchasePrice: Number(r.purchasePrice) }));
}

// Champs optionnels selon le métier de l'entreprise (voir Company.businessType
// et le formulaire produit) — toujours facultatifs, jamais bloquants.
function parseBusinessFields(formData: FormData) {
  const str = (key: string) => {
    const v = String(formData.get(key) || "").trim();
    return v || null;
  };
  const warrantyRaw = formData.get("warrantyMonths");
  return {
    brand: str("brand"),
    reference: str("reference"),
    material: str("material"),
    publisher: str("publisher"),
    warrantyMonths: warrantyRaw && String(warrantyRaw) !== "" ? Number(warrantyRaw) : null,
    packagingTypeId: str("packagingTypeId"),
  };
}

// La configuration des produits ne fait que créer la fiche catalogue — aucun
// stock ne peut y être saisi directement. Un produit démarre toujours à 0 :
// toute entrée en stock passe par le circuit Bon de commande -> Bon de
// livraison -> Approvisionnement.
export async function createProduct(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "") || null;
  const unitId = String(formData.get("unitId") || "") || null;
  const purchasePrice = Number(formData.get("purchasePrice") || 0);
  const salePrice = Number(formData.get("salePrice") || 0);
  const proPriceRaw = formData.get("proPrice");
  const wholesalePriceRaw = formData.get("wholesalePrice");
  const proPrice = proPriceRaw && String(proPriceRaw) !== "" ? Number(proPriceRaw) : null;
  const wholesalePrice = wholesalePriceRaw && String(wholesalePriceRaw) !== "" ? Number(wholesalePriceRaw) : null;
  const reorderLevel = Number(formData.get("reorderLevel") || 0);
  const packUnitId = String(formData.get("packUnitId") || "") || null;
  const piecesPerPack = Number(formData.get("piecesPerPack") || 0);
  const packPurchasePriceRaw = formData.get("packPurchasePrice");
  const packSalePriceRaw = formData.get("packSalePrice");
  const packPurchasePrice =
    packPurchasePriceRaw && String(packPurchasePriceRaw) !== "" ? Number(packPurchasePriceRaw) : null;
  const packSalePrice = packSalePriceRaw && String(packSalePriceRaw) !== "" ? Number(packSalePriceRaw) : null;
  const { brand, reference, material, warrantyMonths, packagingTypeId, publisher } = parseBusinessFields(formData);

  if (!name) return { error: "Le nom du produit est requis." };
  if (packUnitId && piecesPerPack <= 1)
    return { error: "Le nombre d'unités par lot doit être supérieur à 1." };
  // "1 casier = 24 casiers" n'a pas de sens : l'unité de lot doit désigner un
  // contenant différent de l'unité de base qu'elle regroupe (ex: 1 casier =
  // 24 bouteilles).
  if (packUnitId && packUnitId === unitId)
    return { error: "L'unité de lot doit être différente de l'unité de base." };
  if (packagingTypeId) {
    const packagingType = await prisma.packagingType.findFirst({ where: { id: packagingTypeId, companyId } });
    if (!packagingType) return { error: "Type d'emballage introuvable." };
  }

  const supplierPrices = await parseSupplierPrices(formData, companyId);

  try {
    await prisma.product.create({
      data: {
        name,
        barcode: await generateUniqueBarcode(companyId),
        categoryId,
        unitId,
        purchasePrice,
        salePrice,
        proPrice,
        wholesalePrice,
        reorderLevel,
        packUnitId,
        piecesPerPack: packUnitId ? piecesPerPack : 1,
        packPurchasePrice: packUnitId ? packPurchasePrice : null,
        packSalePrice: packUnitId ? packSalePrice : null,
        brand,
        reference,
        material,
        warrantyMonths,
        packagingTypeId,
        publisher,
        companyId,
        supplierPrices: {
          create: supplierPrices.map((sp) => ({ supplierId: sp.supplierId, purchasePrice: sp.purchasePrice, companyId })),
        },
      },
    });

    revalidatePath("/produits");
    return { success: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique"))
      return { error: "Ce code-barres existe déjà." };
    return { error: "Erreur lors de la création du produit." };
  }
}

export async function updateProduct(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "") || null;
  const unitId = String(formData.get("unitId") || "") || null;
  const purchasePrice = Number(formData.get("purchasePrice") || 0);
  const salePrice = Number(formData.get("salePrice") || 0);
  const proPriceRaw = formData.get("proPrice");
  const wholesalePriceRaw = formData.get("wholesalePrice");
  const proPrice = proPriceRaw && String(proPriceRaw) !== "" ? Number(proPriceRaw) : null;
  const wholesalePrice = wholesalePriceRaw && String(wholesalePriceRaw) !== "" ? Number(wholesalePriceRaw) : null;
  const reorderLevel = Number(formData.get("reorderLevel") || 0);
  const packUnitId = String(formData.get("packUnitId") || "") || null;
  const piecesPerPack = Number(formData.get("piecesPerPack") || 0);
  const packPurchasePriceRaw = formData.get("packPurchasePrice");
  const packSalePriceRaw = formData.get("packSalePrice");
  const packPurchasePrice =
    packPurchasePriceRaw && String(packPurchasePriceRaw) !== "" ? Number(packPurchasePriceRaw) : null;
  const packSalePrice = packSalePriceRaw && String(packSalePriceRaw) !== "" ? Number(packSalePriceRaw) : null;
  const { brand, reference, material, warrantyMonths, packagingTypeId, publisher } = parseBusinessFields(formData);

  if (!id || !name) return { error: "Données invalides." };
  if (packUnitId && piecesPerPack <= 1)
    return { error: "Le nombre d'unités par lot doit être supérieur à 1." };
  if (packUnitId && packUnitId === unitId)
    return { error: "L'unité de lot doit être différente de l'unité de base." };
  if (packagingTypeId) {
    const packagingType = await prisma.packagingType.findFirst({ where: { id: packagingTypeId, companyId } });
    if (!packagingType) return { error: "Type d'emballage introuvable." };
  }

  const existing = await prisma.product.findFirst({ where: { id, companyId } });
  if (!existing) return { error: "Produit introuvable." };

  const supplierPrices = await parseSupplierPrices(formData, companyId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id, companyId },
        data: {
          name,
          categoryId,
          unitId,
          purchasePrice,
          salePrice,
          proPrice,
          wholesalePrice,
          reorderLevel,
          packUnitId,
          piecesPerPack: packUnitId ? piecesPerPack : 1,
          packPurchasePrice: packUnitId ? packPurchasePrice : null,
          packSalePrice: packUnitId ? packSalePrice : null,
          brand,
          reference,
          material,
          warrantyMonths,
          packagingTypeId,
          publisher,
        },
      });

      // Remplace intégralement la liste des tarifs fournisseur par celle
      // soumise — plus simple et sûr qu'un diff ligne à ligne pour une petite liste.
      await tx.productSupplierPrice.deleteMany({ where: { productId: id } });
      if (supplierPrices.length > 0) {
        await tx.productSupplierPrice.createMany({
          data: supplierPrices.map((sp) => ({
            productId: id,
            supplierId: sp.supplierId,
            purchasePrice: sp.purchasePrice,
            companyId,
          })),
        });
      }
    });

    revalidatePath("/produits");
    return { success: true };
  } catch {
    return { error: "Erreur lors de la mise à jour." };
  }
}

export async function toggleProductActive(_id: string) {
  return { error: DELETE_LOCKED_MESSAGE };
}

export async function createCategory(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Le nom est requis." };
  try {
    await prisma.category.create({ data: { name, companyId } });
    revalidatePath("/produits");
    revalidatePath("/categories");
    return { success: true };
  } catch {
    return { error: "Cette catégorie existe déjà." };
  }
}

export async function createUnit(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const symbol = String(formData.get("symbol") || "").trim();
  if (!name || !symbol) return { error: "Nom et symbole requis." };
  try {
    await prisma.unit.create({ data: { name, symbol, companyId } });
    revalidatePath("/produits");
    revalidatePath("/categories");
    return { success: true };
  } catch {
    return { error: "Cette unité existe déjà." };
  }
}

// Un type d'emballage (casier standard, casier renforcé, bouteille consignée
// seule...) porte son propre montant de consigne, configuré une seule fois
// et partagé par tous les produits qui l'utilisent.
export async function createPackagingType(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const deposit = Number(formData.get("deposit") || 0);
  if (!name) return { error: "Nom requis." };
  if (deposit <= 0) return { error: "Le montant de consigne doit être supérieur à 0." };
  try {
    await prisma.packagingType.create({ data: { name, deposit, companyId } });
    revalidatePath("/produits");
    revalidatePath("/categories");
    return { success: true };
  } catch {
    return { error: "Ce type d'emballage existe déjà." };
  }
}

export async function togglePackagingTypeActive(id: string) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const packagingType = await prisma.packagingType.findFirst({ where: { id, companyId } });
  if (!packagingType) return { error: "Type d'emballage introuvable." };

  await prisma.packagingType.update({ where: { id }, data: { active: !packagingType.active } });
  revalidatePath("/categories");
  revalidatePath("/produits");
  return { success: true };
}
