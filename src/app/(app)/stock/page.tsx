import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StockClient } from "@/components/stock/StockClient";

export default async function StockPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [products, warehouses, movements] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { name: "asc" },
      include: { unit: true, stocks: true },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: { companyId, type: { notIn: ["TRANSFERT_ENTREE", "TRANSFERT_SORTIE"] } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { product: true, warehouse: true, user: true },
    }),
  ]);

  return <StockClient products={products} warehouses={warehouses} movements={movements} />;
}
