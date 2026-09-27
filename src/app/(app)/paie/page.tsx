import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userHasPermission } from "@/lib/actions/permissions";
import { redirect } from "next/navigation";
import { PayslipsClient } from "@/components/hr/PayslipsClient";

export default async function PaiePage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (!(await userHasPermission(user, "paie.gerer"))) redirect("/dashboard");
  const companyId = user.companyId;

  const [payslips, employees, company] = await Promise.all([
    prisma.payslip.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { employee: true },
    }),
    prisma.employee.findMany({ where: { companyId, active: true }, orderBy: { createdAt: "desc" } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, address: true, phone: true },
    }),
  ]);

  return (
    <PayslipsClient
      payslips={payslips}
      employees={employees}
      companyName={company?.name ?? ""}
      companyAddress={company?.address ?? null}
      companyPhone={company?.phone ?? null}
    />
  );
}
