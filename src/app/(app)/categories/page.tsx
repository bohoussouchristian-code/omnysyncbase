import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/actions/permissions";
import { redirect } from "next/navigation";
import { CategoriesClient } from "@/components/products/CategoriesClient";

export default async function CategoriesPage() {
  const current = await getCurrentUser();
  if (!current?.companyId) redirect("/produits");
  if (!(await userHasPermission(current, "produits.gerer"))) redirect("/produits");
  const companyId = current.companyId;

  const [categories, units, packagingTypes] = await Promise.all([
    prisma.category.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.unit.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.packagingType.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ]);

  return <CategoriesClient categories={categories} units={units} packagingTypes={packagingTypes} />;
}
