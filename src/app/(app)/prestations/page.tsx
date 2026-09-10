import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PrestationsClient } from "@/components/services/PrestationsClient";

export default async function PrestationsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { category: true },
    }),
    prisma.category.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);
  const canManage = user.role === "ADMIN";

  return <PrestationsClient services={services} categories={categories} canManage={canManage} />;
}
