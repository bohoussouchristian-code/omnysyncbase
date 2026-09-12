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

export async function createProduct(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

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
  const initialQty = Number(formData.get("initialQty") || 0);
  const warehouseId = String(formData.get("warehouseId") || "");
  const packUnitId = String(formData.get("packUnitId") || "") || null;
  const piecesPerPack = Number(formData.get("piecesPerPack") || 0);
  const packPurchasePriceRaw = formData.get("packPurchasePrice");
  const packSalePriceRaw = formData.get("packSalePrice");
  const packPurchasePrice =
    packPurchasePriceRaw && String(packPurchasePriceRaw) !== "" ? Number(packPurchasePriceRaw) : null;
  const packSalePrice = packSalePriceRaw && String(packSalePriceRaw) !== "" ? Number(packSalePriceRaw) : null;

  if (!name) return { error: "Le nom du produit est requis." };
  if (!warehouseId) return { error: "Sélectionnez un dépôt." };
  if (packUnitId && piecesPerPack <= 1)
    return { error: "Le nombre d'unités par lot doit être supérieur à 1." };

  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
  if (!warehouse) return { error: "Dépôt introuvable." };

  try {
    const barcode = await generateUniqueBarcode(companyId);
    const product = await prisma.product.create({
      data: {
        name,
        barcode,
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
        companyId,
      },
    });

    if (initialQty > 0) {
      await prisma.stock.create({
        data: { productId: product.id, warehouseId, quantity: initialQty, companyId },
      });
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          warehouseId,
          type: "ENTREE",
          quantity: initialQty,
          reason: "Stock initial",
          userId: user.id,
          companyId,
        },
      });
    }

    revalidatePath("/produits");
    revalidatePath("/stock");
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
  const { user, companyId } = check;

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
  const stockWarehouseId = String(formData.get("warehouseId") || "");
  const addQty = Number(formData.get("addQty") || 0);

  if (!id || !name) return { error: "Données invalides." };
  if (packUnitId && piecesPerPack <= 1)
    return { error: "Le nombre d'unités par lot doit être supérieur à 1." };
  if (addQty > 0 && !stockWarehouseId) return { error: "Sélectionnez un dépôt pour l'ajout de stock." };

  const existing = await prisma.product.findFirst({ where: { id, companyId } });
  if (!existing) return { error: "Produit introuvable." };

  if (addQty > 0) {
    const warehouse = await prisma.warehouse.findFirst({ where: { id: stockWarehouseId, companyId } });
    if (!warehouse) return { error: "Dépôt introuvable." };
  }

  try {
    await prisma.product.update({
      where: { id },
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
      },
    });

    // L'entrée de stock est désormais intégrée à la fiche produit plutôt qu'une
    // action séparée sur la page Stock Général.
    if (addQty > 0) {
      const stock = await prisma.stock.findUnique({
        where: { productId_warehouseId: { productId: id, warehouseId: stockWarehouseId } },
      });
      if (stock) {
        await prisma.stock.update({ where: { id: stock.id }, data: { quantity: { increment: addQty } } });
      } else {
        await prisma.stock.create({
          data: { productId: id, warehouseId: stockWarehouseId, quantity: addQty, companyId },
        });
      }
      await prisma.stockMovement.create({
        data: {
          productId: id,
          warehouseId: stockWarehouseId,
          type: "ENTREE",
          quantity: addQty,
          reason: "Ajout depuis Configuration des produits",
          userId: user.id,
          companyId,
        },
      });
      revalidatePath("/stock");
    }

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
