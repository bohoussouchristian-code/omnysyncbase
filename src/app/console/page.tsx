import { prisma } from "@/lib/prisma";
import { ConsoleClient } from "@/components/console/ConsoleClient";

export default async function ConsolePage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, products: true, sales: true } } },
  });

  return <ConsoleClient companies={companies} />;
}
