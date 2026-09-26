import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CustomersClient } from "@/components/partners/CustomersClient";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const [customers, company] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
    }),
    prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } }),
  ]);
  const canManage = user.role === "ADMIN";

  return (
    <CustomersClient
      customers={customers}
      canManage={canManage}
      companyName={company?.name ?? ""}
      userName={user.name}
    />
  );
}
