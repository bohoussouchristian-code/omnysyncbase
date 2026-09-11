import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PurchaseOrdersClient } from "@/components/purchases/PurchaseOrdersClient";

export default async function AchatsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [purchases, products, suppliers, generalWarehouse] = await Promise.all([
    prisma.purchase.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 100,
      include: {
        supplier: true,
        warehouse: true,
        items: { include: { product: true } },
        receivedBy: true,
      },
    }),
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { name: "asc" },
      include: { unit: true, packUnit: true },
    }),
    prisma.supplier.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.warehouse.findFirst({ where: { companyId, isGeneral: true, active: true } }),
  ]);

  return (
    <PurchaseOrdersClient
      purchases={purchases}
      products={products}
      suppliers={suppliers}
      generalWarehouseName={generalWarehouse?.name ?? null}
    />
  );
}
