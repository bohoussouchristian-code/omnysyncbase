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

  const [rawActiveSales, cancelledSales, cashSessions] = await Promise.all([
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

  return <AnnulationsClient activeSales={activeSales} cancelledSales={cancelledSales} />;
}
