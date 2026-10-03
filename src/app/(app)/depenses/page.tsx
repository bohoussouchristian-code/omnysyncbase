import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExpensesClient } from "@/components/expenses/ExpensesClient";

export default async function DepensesPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [expenses, warehouses, envelopes] = await Promise.all([
    prisma.expense.findMany({
      where: { companyId, cancelled: false },
      orderBy: { date: "desc" },
      take: 150,
      include: { warehouse: true, user: true },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { id: "desc" } }),
    prisma.expenseEnvelope.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        vouchers: {
          orderBy: { issuedAt: "desc" },
          take: 20,
          include: { issuedBy: { select: { name: true } } },
        },
      },
    }),
  ]);

  const canManageBudgets = user.role === "ADMIN" || user.role === "GERANT";

  return (
    <ExpensesClient
      expenses={expenses}
      warehouses={warehouses}
      envelopes={envelopes}
      canManageBudgets={canManageBudgets}
    />
  );
}
