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

  const [sales, payments, proformas, company] = await Promise.all([
    prisma.sale.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { date: "desc" },
      include: { warehouse: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { date: "desc" },
      include: { sale: { select: { number: true, status: true } } },
    }),
    prisma.proforma.findMany({
      where: { customerId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } }),
  ]);

  return (
    <CustomerDossierClient
      customer={customer}
      sales={sales}
      payments={payments}
      proformas={proformas}
      canManage={user.role === "ADMIN"}
      companyName={company?.name ?? ""}
      userName={user.name}
    />
  );
}
