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
      where: { companyId },
      orderBy: { date: "desc" },
      take: 150,
      include: { warehouse: true, user: true },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.expenseEnvelope.findMany({
      where: { companyId },
      orderBy: { category: "asc" },
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
