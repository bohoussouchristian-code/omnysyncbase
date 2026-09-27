import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TresorerieClient } from "@/components/bank/TresorerieClient";

export default async function TresoreriePage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "GERANT" && user.role !== "COMPTABLE") redirect("/dashboard");
  const canManage = user.role === "ADMIN" || user.role === "GERANT";
  const companyId = user.companyId;

  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    include: {
      transactions: {
        orderBy: { date: "desc" },
        take: 100,
        include: { user: { select: { name: true } } },
      },
      reconciliations: {
        orderBy: { statementDate: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  });

  return <TresorerieClient accounts={accounts} canManage={canManage} />;
}
