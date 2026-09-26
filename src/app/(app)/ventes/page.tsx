import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VenteDuJourClient } from "@/components/sales/VenteDuJourClient";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function VentesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const { tab, from: fromParam, to: toParam } = await searchParams;
  const initialTab = tab === "achats" ? "achats" : tab === "historique" ? "historique" : "jour";

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const fromStr = fromParam || toISODate(defaultFrom);
  const toStr = toParam || toISODate(now);
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const [products, services, warehouses, customers, recentSales, clientSales, allCustomers, company, historySales] =
    await Promise.all([
      prisma.product.findMany({
        where: { active: true, companyId },
        orderBy: { name: "asc" },
        include: { unit: true, packUnit: true, packagingType: true, stocks: true },
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
      prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
      // Coûteux (jusqu'à 500 ventes avec tous leurs articles) : chargé
      // seulement quand l'onglet Historique est effectivement demandé.
      initialTab === "historique"
        ? prisma.sale.findMany({
            where: { companyId, date: { gte: from, lte: to } },
            orderBy: { date: "desc" },
            take: 500,
            include: {
              customer: true,
              warehouse: true,
              user: true,
              items: { include: { product: { include: { unit: true, packUnit: true } }, service: true } },
              payments: { select: { amount: true, cashReceived: true, changeGiven: true } },
            },
          })
        : Promise.resolve([]),
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
      historySales={historySales}
      historyFrom={fromStr}
      historyTo={toStr}
      companyName={company?.name ?? ""}
    />
  );
}
