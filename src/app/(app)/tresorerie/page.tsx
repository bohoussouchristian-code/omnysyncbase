import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/actions/permissions";
import { redirect } from "next/navigation";
import { getGeneralBalanceData } from "@/lib/actions/generalBalance";
import { TresorerieClient } from "@/components/bank/TresorerieClient";

export default async function TresoreriePage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (!(await userHasPermission(user, "rapports.voir"))) redirect("/dashboard");
  const canManage = await userHasPermission(user, "banque.gerer");
  const canReconcile = await userHasPermission(user, "banque.rapprocher");
  const companyId = user.companyId;

  const [accounts, generalBalance] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
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
    }),
    getGeneralBalanceData(),
  ]);

  return (
    <TresorerieClient
      accounts={accounts}
      canManage={canManage}
      canReconcile={canReconcile}
      generalBalance={"error" in generalBalance ? null : generalBalance}
      canDecaisserGeneral={user.role === "ADMIN"}
    />
  );
}
