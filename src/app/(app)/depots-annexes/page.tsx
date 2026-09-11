import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnnexWarehousesClient } from "@/components/warehouses/AnnexWarehousesClient";

export default async function DepotsAnnexesPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [generalWarehouse, annexesRaw] = await Promise.all([
    prisma.warehouse.findFirst({ where: { companyId, isGeneral: true } }),
    prisma.warehouse.findMany({
      where: { companyId, isGeneral: false },
      orderBy: { name: "asc" },
      include: { stocks: { include: { product: true } } },
    }),
  ]);

  const annexes = annexesRaw.map((w) => {
    const referenced = w.stocks.filter((s) => s.quantity > 0);
    const stockValue = w.stocks.reduce((sum, s) => sum + s.quantity * s.product.purchasePrice, 0);
    return {
      id: w.id,
      name: w.name,
      type: w.type,
      address: w.address,
      active: w.active,
      productCount: referenced.length,
      stockValue,
    };
  });

  return <AnnexWarehousesClient generalWarehouseName={generalWarehouse?.name ?? null} annexes={annexes} />;
}
