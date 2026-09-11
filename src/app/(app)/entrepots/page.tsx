import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WarehousesClient } from "@/components/warehouses/WarehousesClient";

export default async function EntrepotsPage() {
  const current = await getCurrentUser();
  if (!current?.companyId || current.role !== "ADMIN") redirect("/dashboard");

  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: current.companyId },
    orderBy: [{ isGeneral: "desc" }, { name: "asc" }],
    include: { _count: { select: { stocks: true } } },
  });

  return <WarehousesClient warehouses={warehouses} />;
}
