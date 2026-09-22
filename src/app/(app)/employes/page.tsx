import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmployeesClient } from "@/components/hr/EmployeesClient";

export default async function EmployesPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const employees = await prisma.employee.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
  });

  return <EmployeesClient employees={employees} />;
}
