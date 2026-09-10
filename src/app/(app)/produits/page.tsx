import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProductsClient } from "@/components/products/ProductsClient";

export default async function ProduitsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const [products, categories, units, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { category: true, unit: true, packUnit: true, stocks: true },
    }),
    prisma.category.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: { active: true, companyId }, orderBy: { name: "asc" } }),
  ]);
  const canManage = user.role === "ADMIN";

  return (
    <ProductsClient
      products={products}
      categories={categories}
      units={units}
      warehouses={warehouses}
      canManage={canManage}
    />
  );
}
