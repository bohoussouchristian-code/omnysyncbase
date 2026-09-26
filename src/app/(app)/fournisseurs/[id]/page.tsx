import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { SupplierDossierClient } from "@/components/partners/SupplierDossierClient";

export default async function SupplierDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  const { id } = await params;

  const supplier = await prisma.supplier.findFirst({ where: { id, companyId: user.companyId } });
  if (!supplier) notFound();

  const [purchases, payments] = await Promise.all([
    prisma.purchase.findMany({
      where: { supplierId: id, companyId: user.companyId },
      orderBy: { date: "asc" },
      include: { warehouse: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { supplierId: id, companyId: user.companyId },
      orderBy: { date: "asc" },
    }),
  ]);

  return <SupplierDossierClient supplier={supplier} purchases={purchases} payments={payments} />;
}
