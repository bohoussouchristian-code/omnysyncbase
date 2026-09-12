import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EntrepriseClient } from "@/components/company/EntrepriseClient";

export default async function EntreprisePage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const company = await prisma.company.findUnique({ where: { id: user.companyId } });
  if (!company) redirect("/dashboard");

  return <EntrepriseClient company={company} />;
}
