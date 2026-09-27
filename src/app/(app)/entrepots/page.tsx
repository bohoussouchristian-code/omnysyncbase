import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WarehousesClient } from "@/components/warehouses/WarehousesClient";

export default async function EntrepotsPage() {
  const current = await getCurrentUser();
  if (!current?.companyId || current.role !== "ADMIN") redirect("/dashboard");

  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: current.companyId },
    // Le Dépôt Général reste toujours en tête (rôle structurel), le reste
    // du tri se fait par le plus récent créé en premier (id, cuid croissant).
    orderBy: [{ isGeneral: "desc" }, { id: "desc" }],
    include: { _count: { select: { stocks: true } } },
  });

  return <WarehousesClient warehouses={warehouses} />;
}
