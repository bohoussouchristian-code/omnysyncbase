import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/actions/permissions";
import { redirect } from "next/navigation";
import { AnnulationsClient } from "@/components/annulations/AnnulationsClient";

export default async function AnnulationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  // Module unique pour toute annulation (ventes, dépenses, livraisons) :
  // chaque catégorie a sa propre permission ("ventes.annuler",
  // "depenses.annuler", "livraisons.annuler"), déléguable indépendamment.
  // Chaque section masque son propre bouton "Annuler" quand la permission
  // manque, plutôt que de bloquer l'accès à la page entière.
  const [canCancelSales, canCancelExpenses, canCancelDeliveries] = await Promise.all([
    userHasPermission(user, "ventes.annuler"),
    userHasPermission(user, "depenses.annuler"),
    userHasPermission(user, "livraisons.annuler"),
  ]);
  if (!canCancelSales && !canCancelExpenses && !canCancelDeliveries) redirect("/dashboard");
  const companyId = user.companyId;

  const { tab: tabParam } = await searchParams;
  const initialTab = tabParam === "depenses" ? "depenses" : tabParam === "livraisons" ? "livraisons" : "ventes";

  const [rawActiveSales, cancelledSales, cashSessions, activeExpenses, cancelledExpenses, activeDeliveries, cancelledDeliveries] =
    await Promise.all([
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
      prisma.cashSession.findMany({ where: { companyId } }),
      prisma.expense.findMany({
        where: { companyId, cancelled: false },
        orderBy: { date: "desc" },
        take: 150,
        include: { warehouse: true, user: true },
      }),
      prisma.expense.findMany({
        where: { companyId, cancelled: true },
        orderBy: { cancelledAt: "desc" },
        take: 150,
        include: { warehouse: true, cancelledBy: true },
      }),
      prisma.delivery.findMany({
        where: { companyId, status: { not: "ANNULEE" } },
        orderBy: { createdAt: "desc" },
        take: 150,
        include: { customer: { select: { name: true } } },
      }),
      prisma.delivery.findMany({
        where: { companyId, status: "ANNULEE" },
        orderBy: { cancelledAt: "desc" },
        take: 150,
        include: { customer: { select: { name: true } }, cancelledBy: { select: { name: true } } },
      }),
    ]);

  // Une vente encaissée est verrouillée dès que la session de caisse dans
  // laquelle elle a été payée a été clôturée : la caissière a déjà justifié
  // son compte sur ce total, il ne peut plus bouger après coup. Une vente
  // encore en attente n'est jamais concernée, elle n'a touché aucune caisse.
  const activeSales = rawActiveSales.map((s) => {
    if (s.status === "EN_ATTENTE" || !s.validatedById || !s.validatedAt) {
      return { ...s, locked: false };
    }
    const validatedAt = s.validatedAt;
    const coveringSession = cashSessions
      .filter((cs) => cs.warehouseId === s.warehouseId && cs.userId === s.validatedById && cs.openedAt <= validatedAt)
      .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())[0];
    return { ...s, locked: !!coveringSession?.closedAt };
  });

  return (
    <AnnulationsClient
      initialTab={initialTab}
      activeSales={activeSales}
      cancelledSales={cancelledSales}
      canCancelSales={canCancelSales}
      activeExpenses={activeExpenses}
      cancelledExpenses={cancelledExpenses}
      canCancelExpenses={canCancelExpenses}
      activeDeliveries={activeDeliveries}
      cancelledDeliveries={cancelledDeliveries}
      canCancelDeliveries={canCancelDeliveries}
    />
  );
}
