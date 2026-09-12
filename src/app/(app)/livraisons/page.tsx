import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DeliveriesClient } from "@/components/purchases/DeliveriesClient";

export default async function LivraisonsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const purchases = await prisma.purchase.findMany({
    // Un brouillon (non encore validé) n'a pas été envoyé au fournisseur :
    // il n'apparaît pas ici tant qu'il n'est pas validé depuis Bons de commande.
    where: { companyId, status: { in: ["EN_ATTENTE", "RECUE"] }, validatedAt: { not: null } },
    orderBy: { date: "desc" },
    take: 150,
    include: {
      supplier: true,
      warehouse: true,
      items: { include: { product: true } },
      receivedBy: true,
    },
  });

  return <DeliveriesClient purchases={purchases} />;
}
