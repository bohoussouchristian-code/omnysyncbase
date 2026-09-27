import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DeliveriesClient } from "@/components/deliveries/DeliveriesClient";

export default async function LivraisonClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ saleId?: string; customerId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  // Accessible à tout employé : un livreur assigné (n'importe quel rôle) doit
  // pouvoir venir confirmer sa propre livraison ici, pas seulement un
  // administrateur/gérant (qui restent seuls à pouvoir créer/encaisser/annuler).
  const companyId = user.companyId;
  const canManage = user.role === "ADMIN" || user.role === "GERANT";

  const { saleId, customerId } = await searchParams;

  const [deliveries, customers, products, employees] = await Promise.all([
    prisma.delivery.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        customer: { select: { name: true } },
        sale: { select: { number: true } },
        user: { select: { name: true } },
        product: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
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
    prisma.user.findMany({
      where: { companyId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <DeliveriesClient
      deliveries={deliveries}
      customers={customers}
      products={products}
      employees={employees}
      canManage={canManage}
      currentUserId={user.id}
      initialSaleId={saleId || null}
      initialCustomerId={customerId || null}
    />
  );
}
