import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnnulationsDepensesClient } from "@/components/expenses/AnnulationsDepensesClient";

export default async function AnnulationsDepensesPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  // Seul un administrateur peut annuler une dépense (même règle que pour les
  // factures) : module dédié, distinct de l'annulation des ventes.
  if (user.role !== "ADMIN") redirect("/dashboard");
  const companyId = user.companyId;

  const [activeExpenses, cancelledExpenses] = await Promise.all([
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
  ]);

  return <AnnulationsDepensesClient activeExpenses={activeExpenses} cancelledExpenses={cancelledExpenses} />;
}
