import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SalesHistoryClient } from "@/components/sales/SalesHistoryClient";

export default async function SalesHistoryPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const sales = await prisma.sale.findMany({
    where: { companyId: user.companyId },
    orderBy: { date: "desc" },
    take: 200,
    include: {
      customer: true,
      warehouse: true,
      user: true,
      items: { include: { product: true, service: true } },
    },
  });

  return <SalesHistoryClient sales={sales} canCancel={user.role === "ADMIN"} />;
}
