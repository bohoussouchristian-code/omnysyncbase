import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProformasClient } from "@/components/proformas/ProformasClient";

export default async function ProformasPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [products, services, customers, proformas, company] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { name: "asc" },
      include: { unit: true },
    }),
    prisma.service.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.proforma.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: true,
        user: true,
        items: { include: { product: { include: { unit: true } }, service: true } },
      },
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);

  return (
    <ProformasClient
      products={products}
      services={services}
      customers={customers}
      proformas={proformas}
      companyName={company?.name ?? ""}
    />
  );
}
