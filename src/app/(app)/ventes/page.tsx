import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PosClient } from "@/components/sales/PosClient";
import { RecentSalesTable } from "@/components/sales/RecentSalesTable";
import Link from "next/link";

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nouvelle vente</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Saisissez le panier — le paiement sera encaissé séparément à la Caisse
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/caisse-ventes" className="text-blue-600 hover:underline">
            Caisse →
          </Link>
          <Link href="/ventes/historique" className="text-blue-600 hover:underline">
            Historique des ventes →
          </Link>
        </div>
      </div>
      <PosClient products={products} services={services} warehouses={warehouses} customers={customers} />
      <RecentSalesTable sales={recentSales} />
    </div>
  );
}
