import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClientPurchasesClient } from "@/components/sales/ClientPurchasesClient";

export default async function AchatsClientsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [sales, customers] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, customerId: { not: null } },
      orderBy: { date: "desc" },
      take: 500,
      include: {
        customer: true,
        warehouse: true,
        user: true,
        items: { include: { product: true, service: true } },
      },
    }),
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <ClientPurchasesClient sales={sales} customers={customers} />;
}
