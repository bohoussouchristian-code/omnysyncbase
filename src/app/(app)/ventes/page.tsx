import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VenteDuJourClient } from "@/components/sales/VenteDuJourClient";

export default async function VentesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const { tab } = await searchParams;
  const initialTab = tab === "achats" ? "achats" : "jour";

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const [products, services, warehouses, customers, recentSales, clientSales, allCustomers] = await Promise.all([
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
    prisma.sale.findMany({
      where: { companyId, customerId: { not: null } },
      orderBy: { date: "desc" },
      take: 500,
      include: {
        customer: true,
        warehouse: true,
        user: true,
        items: { include: { product: true, service: true } },
      },
    }),
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const assignedWarehouseId =
    user.role === "CAISSIER" || user.role === "MAGASINIER" ? user.warehouseId : undefined;

  return (
    <VenteDuJourClient
      products={products}
      services={services}
      warehouses={warehouses}
      customers={customers}
      recentSales={recentSales}
      clientSales={clientSales}
      allCustomers={allCustomers}
      assignedWarehouseId={assignedWarehouseId}
      initialTab={initialTab}
    />
  );
}
