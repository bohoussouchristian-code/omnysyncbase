import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CustomersClient } from "@/components/partners/CustomersClient";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
    include: {
      sales: { orderBy: { date: "desc" }, take: 10 },
      payments: { orderBy: { date: "desc" }, take: 10 },
    },
  });
  const canManage = user.role === "ADMIN";

  return <CustomersClient customers={customers} canManage={canManage} />;
}
