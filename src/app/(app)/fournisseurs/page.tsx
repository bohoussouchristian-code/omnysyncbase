import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuppliersClient } from "@/components/partners/SuppliersClient";

export default async function FournisseursPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const suppliers = await prisma.supplier.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
    include: {
      purchases: { orderBy: { date: "desc" }, take: 10 },
      payments: { orderBy: { date: "desc" }, take: 10 },
    },
  });
  const canManage = user.role === "ADMIN";

  return <SuppliersClient suppliers={suppliers} canManage={canManage} />;
}
