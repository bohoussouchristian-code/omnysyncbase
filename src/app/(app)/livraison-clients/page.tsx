import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DeliveriesClient } from "@/components/deliveries/DeliveriesClient";

export default async function LivraisonClientsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "GERANT") redirect("/dashboard");
  const companyId = user.companyId;

  const [deliveries, customers, products] = await Promise.all([
    prisma.delivery.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        customer: { select: { name: true } },
        sale: { select: { number: true } },
        user: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.customer.findMany({
      where: { companyId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, piecesPerPack: true, packUnit: { select: { symbol: true } } },
    }),
  ]);

  return <DeliveriesClient deliveries={deliveries} customers={customers} products={products} />;
}
