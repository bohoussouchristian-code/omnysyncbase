import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CashClient } from "@/components/cash/CashClient";

export default async function CaissePage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [warehouses, sessions, mySession] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.cashSession.findMany({
      where: { companyId },
      orderBy: { openedAt: "desc" },
      take: 30,
      include: { warehouse: true, user: true },
    }),
    prisma.cashSession.findFirst({
      where: { userId: user.id, closedAt: null, companyId },
      include: { warehouse: true },
    }),
  ]);

  return <CashClient warehouses={warehouses} sessions={sessions} mySession={mySession} />;
}
