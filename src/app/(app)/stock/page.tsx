import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StockClient } from "@/components/stock/StockClient";

export default async function StockPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { createdAt: "desc" },
      include: {
        unit: true,
        stocks: true,
        supplierPrices: { include: { supplier: { select: { name: true } } } },
      },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { id: "desc" } }),
  ]);

  return <StockClient products={products} warehouses={warehouses} />;
}
