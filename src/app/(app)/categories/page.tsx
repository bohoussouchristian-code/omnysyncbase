import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CategoriesClient } from "@/components/products/CategoriesClient";

export default async function CategoriesPage() {
  const current = await getCurrentUser();
  if (!current?.companyId || current.role !== "ADMIN") redirect("/produits");
  const companyId = current.companyId;

  const [categories, units] = await Promise.all([
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
  ]);

  return <CategoriesClient categories={categories} units={units} />;
}
