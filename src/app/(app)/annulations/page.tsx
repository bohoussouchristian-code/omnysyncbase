import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnnulationsClient } from "@/components/sales/AnnulationsClient";

export default async function AnnulationsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  // Seul un administrateur peut annuler une facture (même règle déjà en
  // place côté serveur dans cancelSale) : ce module centralise toutes les
  // annulations, il n'a donc de sens que pour ce rôle.
  if (user.role !== "ADMIN") redirect("/dashboard");
  const companyId = user.companyId;

  const [activeSales, cancelledSales] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, status: { not: "ANNULEE" } },
      orderBy: { date: "desc" },
      take: 150,
      include: { customer: true, warehouse: true, user: true },
    }),
    prisma.sale.findMany({
      where: { companyId, status: "ANNULEE" },
      orderBy: { cancelledAt: "desc" },
      take: 150,
      include: { customer: true, warehouse: true, cancelledBy: true },
    }),
  ]);

  return <AnnulationsClient activeSales={activeSales} cancelledSales={cancelledSales} />;
}
