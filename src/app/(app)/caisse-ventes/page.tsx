import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CaisseValidationClient } from "@/components/sales/CaisseValidationClient";

export default async function CaisseVentesPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const companyId = user.companyId;

  const itemsInclude = { include: { product: true, service: true } } as const;

  const [pending, validated] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, status: "EN_ATTENTE" },
      orderBy: { date: "asc" },
      include: {
        customer: true,
        warehouse: true,
        user: true,
        items: itemsInclude,
      },
    }),
    prisma.sale.findMany({
      where: { companyId, validatedAt: { not: null } },
      orderBy: { validatedAt: "desc" },
      take: 20,
      include: { customer: true, warehouse: true, validatedBy: true },
    }),
  ]);

  return <CaisseValidationClient pending={pending} validated={validated} />;
}
