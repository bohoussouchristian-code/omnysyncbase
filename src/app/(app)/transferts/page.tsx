import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TransfersClient } from "@/components/stock/TransfersClient";

export default async function TransfertsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [products, warehouses, movements] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { name: "asc" },
      include: { unit: true, packUnit: true, stocks: true },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: { companyId, type: "TRANSFERT_SORTIE" },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { product: { include: { unit: true, packUnit: true } }, warehouse: true, user: true },
    }),
  ]);

  const warehouseNames = new Map(warehouses.map((w) => [w.id, w.name]));
  const transfers = movements.map((m) => ({
    id: m.id,
    quantity: m.quantity,
    createdAt: m.createdAt,
    product: m.product,
    fromWarehouseName: m.warehouse.name,
    toWarehouseName: (m.relatedWarehouseId && warehouseNames.get(m.relatedWarehouseId)) || "—",
    user: m.user,
  }));

  return <TransfersClient products={products} warehouses={warehouses} transfers={transfers} />;
}
