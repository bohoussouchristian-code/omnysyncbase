import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PosClient } from "@/components/sales/PosClient";
import Link from "next/link";

export default async function VentesPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [products, warehouses, customers] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, companyId },
      orderBy: { name: "asc" },
      include: { unit: true, packUnit: true, stocks: true },
    }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Point de vente</h1>
          <p className="text-sm text-slate-500 mt-0.5">Enregistrez une vente rapidement</p>
        </div>
        <Link href="/ventes/historique" className="text-sm text-blue-600 hover:underline">
          Historique des ventes →
        </Link>
      </div>
      <PosClient
        products={products}
        warehouses={warehouses}
        customers={customers}
        cashierName={user?.name || ""}
      />
    </div>
  );
}
