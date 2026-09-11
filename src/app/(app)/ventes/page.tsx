import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VenteDuJourClient } from "@/components/sales/VenteDuJourClient";

export default async function VentesPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const [products, services, warehouses, customers, recentSales] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { name: "asc" },
      include: { unit: true, packUnit: true, stocks: true },
    }),
    prisma.service.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      where: { companyId, date: { gte: twoDaysAgo } },
      orderBy: { date: "desc" },
      take: 15,
      include: { customer: true, warehouse: true },
    }),
  ]);

  return (
    <VenteDuJourClient
      products={products}
      services={services}
      warehouses={warehouses}
      customers={customers}
      recentSales={recentSales}
    />
  );
}
