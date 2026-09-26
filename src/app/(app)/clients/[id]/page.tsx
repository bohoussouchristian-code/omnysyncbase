import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { CustomerDossierClient } from "@/components/partners/CustomerDossierClient";

export default async function CustomerDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const { id } = await params;

  const customer = await prisma.customer.findFirst({ where: { id, companyId: user.companyId } });
  if (!customer) notFound();

  const [sales, payments, proformas] = await Promise.all([
    prisma.sale.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { date: "asc" },
      include: { warehouse: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { date: "asc" },
    }),
    prisma.proforma.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <CustomerDossierClient
      customer={customer}
      sales={sales}
      payments={payments}
      proformas={proformas}
      canManage={user.role === "ADMIN"}
    />
  );
}
