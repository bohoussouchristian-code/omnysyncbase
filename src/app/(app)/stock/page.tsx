import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StockClient } from "@/components/stock/StockClient";

export default async function StockPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [products, warehouses, stockedItems] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { createdAt: "desc" },
      include: {
        unit: true,
        packUnit: true,
        stocks: true,
        supplierPrices: { include: { supplier: { select: { name: true } } } },
      },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { id: "desc" } }),
    // Dernière entrée en stock de chaque produit (via Approvisionnement) —
    // trié du plus récent au plus ancien pour ne garder que le premier par
    // produit ci-dessous (N° BL, dépôt, fournisseur, date, qui a fait l'entrée).
    prisma.purchaseItem.findMany({
      where: { companyId, purchase: { stockedAt: { not: null } } },
      orderBy: { purchase: { stockedAt: "desc" } },
      select: {
        productId: true,
        receivedQuantity: true,
        purchase: {
          select: {
            number: true,
            stockedAt: true,
            warehouse: { select: { name: true } },
            supplier: { select: { name: true } },
            stockedBy: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // Seule la toute dernière entrée de chaque produit est gardée (la requête
  // est déjà triée du plus récent au plus ancien).
  const lastMovementByProduct: Record<
    string,
    { quantity: number; number: string; warehouseName: string; supplierName: string; date: Date; by: string | null }
  > = {};
  for (const item of stockedItems) {
    if (lastMovementByProduct[item.productId] || !item.purchase.stockedAt) continue;
    lastMovementByProduct[item.productId] = {
      quantity: item.receivedQuantity ?? 0,
      number: item.purchase.number,
      warehouseName: item.purchase.warehouse.name,
      supplierName: item.purchase.supplier.name,
      date: item.purchase.stockedAt,
      by: item.purchase.stockedBy?.name ?? null,
    };
  }

  return <StockClient products={products} warehouses={warehouses} lastMovementByProduct={lastMovementByProduct} />;
}
