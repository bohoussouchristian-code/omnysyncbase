import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SalesHistoryClient } from "@/components/sales/SalesHistoryClient";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const { from: fromParam, to: toParam } = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const fromStr = fromParam || toISODate(defaultFrom);
  const toStr = toParam || toISODate(now);
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const sales = await prisma.sale.findMany({
    where: { companyId: user.companyId, date: { gte: from, lte: to } },
    orderBy: { date: "desc" },
    take: 500,
    include: {
      customer: true,
      warehouse: true,
      user: true,
      items: { include: { product: true, service: true } },
    },
  });

  return <SalesHistoryClient sales={sales} from={fromStr} to={toStr} />;
}
