import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/actions/permissions";
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
  const canManage = await userHasPermission(user, "livraisons.gerer");

  const { saleId, customerId } = await searchParams;

  // La livraison organisée depuis un reçu de caisse reprend automatiquement
  // le produit et la quantité (en casiers) de cette vente — l'agent ne fait
  // que fixer la destination, le prix au kilomètre/zone et qui livre.
  const saleItem = saleId
    ? await prisma.saleItem.findFirst({
        where: { saleId, companyId, productId: { not: null } },
        orderBy: { id: "asc" },
        include: { product: { select: { piecesPerPack: true } } },
      })
    : null;
  const initialProductId = saleItem?.productId ?? null;
  const initialQuantityPacks =
    saleItem && saleItem.product && saleItem.product.piecesPerPack > 0
      ? Math.round((saleItem.quantity / saleItem.product.piecesPerPack) * 100) / 100
      : null;

  const [deliveries, customers, products, employees] = await Promise.all([
    prisma.delivery.findMany({
      where: { companyId, status: { not: "ANNULEE" } },
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
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, piecesPerPack: true, packUnit: { select: { symbol: true } } },
    }),
    prisma.user.findMany({
      where: { companyId, active: true },
      orderBy: { createdAt: "desc" },
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
      initialProductId={initialProductId}
      initialQuantityPacks={initialQuantityPacks}
    />
  );
}
