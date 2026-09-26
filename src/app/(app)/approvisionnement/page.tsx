import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ApprovisionnementClient } from "@/components/purchases/ApprovisionnementClient";

export default async function ApprovisionnementPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  // Une commande reçue (bon de livraison) mais pas encore approvisionnée
  // reste ici tant que le stock n'a pas été crédité ; une fois approvisionnée
  // elle reste visible aussi (historique), stockedAt suffit à distinguer.
  const purchases = await prisma.purchase.findMany({
    where: { companyId, status: "RECUE" },
    orderBy: { receivedAt: "desc" },
    take: 150,
    include: {
      supplier: true,
      warehouse: true,
      items: { include: { product: { include: { unit: true, packUnit: true } } } },
      stockedBy: true,
    },
  });

  return <ApprovisionnementClient purchases={purchases} />;
}
